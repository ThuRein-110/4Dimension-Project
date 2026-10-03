"""Local wildlife inference. stdout is JSONL progress; private result is an atomic JSON file."""
import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
MODELS = {
    'detector': ('IDEA-Research/grounding-dino-tiny', 'a2bb814dd30d776dcf7e30523b00659f4f141c71'),
    'segmenter': ('facebook/sam2.1-hiera-tiny', 'de431c4043854a71d8101e17995dfe596bf101a5'),
    'depth': ('depth-anything/Depth-Anything-V2-Small-hf', '5426e4f0f36572d16453bbda7a8389317b1bef99'),
}


def progress(stage, **values):
    print(json.dumps({'stage': stage, **values}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--fps', type=int, default=5)
    parser.add_argument('--threshold', type=float, default=.23)
    parser.add_argument('--models', required=True)
    parser.add_argument('--duration', type=float, default=120)
    args = parser.parse_args()
    if args.fps not in (2, 3, 5, 10) or not .1 <= args.threshold <= .8:
        raise ValueError('Unsupported sampling settings')
    import cv2
    import numpy as np
    import torch
    import supervision as sv
    from PIL import Image
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, AutoModelForDepthEstimation, Sam2Model, Sam2Processor

    torch.set_num_threads(min(6, os.cpu_count() or 2))
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    progress('loading models', device=device)
    common = {'cache_dir': args.models, 'use_safetensors': True}
    detector_id, detector_revision = MODELS['detector']
    detector_processor = AutoProcessor.from_pretrained(detector_id, revision=detector_revision, cache_dir=args.models)
    detector = AutoModelForZeroShotObjectDetection.from_pretrained(detector_id, revision=detector_revision, **common).to(device).eval()
    segmenter_id, segmenter_revision = MODELS['segmenter']
    mask_processor = Sam2Processor.from_pretrained(segmenter_id, revision=segmenter_revision, cache_dir=args.models)
    segmenter = Sam2Model.from_pretrained(segmenter_id, revision=segmenter_revision, **common).to(device).eval()
    depth_id, depth_revision = MODELS['depth']
    depth_processor = AutoProcessor.from_pretrained(depth_id, revision=depth_revision, cache_dir=args.models)
    depth_model = AutoModelForDepthEstimation.from_pretrained(depth_id, revision=depth_revision, **common).to(device).eval()
    tracker = sv.ByteTrack(track_activation_threshold=args.threshold, lost_track_buffer=90, minimum_matching_threshold=.8, frame_rate=args.fps)
    cap = cv2.VideoCapture(args.input)
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    source_fps = cap.get(cv2.CAP_PROP_FPS)
    duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / source_fps if source_fps else 0
    if not cap.isOpened() or not 0 < duration <= 120:
        raise ValueError('Research analysis requires a decodable video up to 120 seconds')
    duration = min(duration, args.duration)
    frames, tracks, depth_values = [], {}, []
    total = math.ceil(duration * args.fps)
    started = time.monotonic()
    for index in range(total):
        requested = index / args.fps
        cap.set(cv2.CAP_PROP_POS_MSEC, requested * 1000)
        ok, bgr = cap.read()
        if not ok:
            progress('decode warning', done=index, total=total)
            continue
        timestamp = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if frames and timestamp <= frames[-1]['time']:
            raise ValueError('Decoder returned non-increasing timestamps')
        # Ignore encoded black borders during inference, then restore source-image coordinates.
        row_valid = np.where(bgr.mean(axis=(1, 2)) > 3)[0]
        top, bottom = (int(row_valid[0]), int(row_valid[-1]) + 1) if row_valid.size else (0, height)
        if bottom - top < height * .3:
            top, bottom = 0, height
        image = Image.fromarray(cv2.cvtColor(bgr[top:bottom], cv2.COLOR_BGR2RGB))
        inference_start = time.monotonic()
        with torch.inference_mode():
            inputs = detector_processor(images=image, text='a lion. a hyena. an animal.', return_tensors='pt').to(device)
            outputs = detector(**inputs)
            result = detector_processor.post_process_grounded_object_detection(outputs, inputs.input_ids, threshold=args.threshold, text_threshold=.2, target_sizes=[(bottom - top, width)])[0]
            boxes = result['boxes'].cpu().numpy()
            if len(boxes):
                boxes[:, [1, 3]] += top
            scores = result['scores'].cpu().numpy()
            labels = result.get('text_labels', result.get('labels', []))
            # Class-agnostic suppression avoids counting an animal twice under overlapping prompts.
            if len(boxes):
                raw = sv.Detections(xyxy=boxes, confidence=scores, class_id=np.zeros(len(boxes), dtype=int), data={'source_index': np.arange(len(boxes))}).with_nms(threshold=.5, class_agnostic=True)
                valid = (raw.area > width * height * .0004) & (raw.area < width * height * .7)
                raw = raw[valid]
                raw = raw[np.argsort(-raw.confidence)[:32]]
            else:
                raw = sv.Detections.empty()
            tracked = tracker.update_with_detections(raw)
            depth_inputs = depth_processor(images=image, return_tensors='pt').to(device)
            predicted = depth_model(**depth_inputs).predicted_depth
            depth = np.zeros((height, width), dtype=np.float32)
            depth[top:bottom] = torch.nn.functional.interpolate(predicted.unsqueeze(1), size=(bottom - top, width), mode='bicubic', align_corners=False)[0, 0].cpu().numpy()
            thumb_height = min(64, round(32 * (bottom - top) / width))
            thumb = cv2.resize(depth[top:bottom], (32, thumb_height), interpolation=cv2.INTER_AREA)
            depth_values.extend(np.percentile(thumb, [10, 50, 90]).tolist())
            masks, mask_scores = None, None
            if len(tracked):
                prompt_boxes = tracked.xyxy.copy()
                prompt_boxes[:, [1, 3]] -= top
                mask_inputs = mask_processor(images=image, input_boxes=[prompt_boxes.tolist()], return_tensors='pt').to(device)
                mask_outputs = segmenter(**mask_inputs, multimask_output=False)
                masks = mask_processor.post_process_masks(mask_outputs.pred_masks.cpu(), mask_inputs['original_sizes'])[0].numpy()
                mask_scores = mask_outputs.iou_scores.cpu().numpy().reshape(-1)
        subjects = []
        for i, track_id in enumerate(tracked.tracker_id if len(tracked) else []):
            track_id = int(track_id)
            x1, y1, x2, y2 = np.clip(tracked.xyxy[i], [0, 0, 0, 0], [width, height, width, height]).tolist()
            source_index = int(tracked.data['source_index'][i])
            text = str(labels[source_index]).lower()
            label = 'lion / big cat' if 'lion' in text and 'hyena' not in text else 'hyena / canine-like' if 'hyena' in text and 'lion' not in text else 'animal_unknown'
            score = float(tracked.confidence[i])
            track = tracks.setdefault(track_id, {'id': track_id, 'label': label, 'classConfidence': score, 'firstSeen': timestamp, 'lastSeen': timestamp, 'observations': 0, 'votes': {}})
            track['votes'][label] = track['votes'].get(label, 0) + score
            track['label'] = max(track['votes'], key=track['votes'].get)
            track['classConfidence'] = min(.85, track['votes'][track['label']] / max(.001, sum(track['votes'].values())) * score)
            track['lastSeen'] = timestamp
            track['observations'] += 1
            polygons, mask_quality, median, dispersion = [], None, None, None
            if masks is not None:
                mask = np.zeros((height, width), dtype=np.uint8)
                mask[top:bottom] = np.asarray(masks[i, 0], dtype=np.uint8)
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:4]:
                    if cv2.contourArea(contour) < 8:
                        continue
                    contour = cv2.approxPolyDP(contour, max(1, cv2.arcLength(contour, True) * .002), True).reshape(-1, 2)
                    if len(contour) >= 3:
                        polygons.append([[round(float(x / width), 5), round(float(y / height), 5)] for x, y in contour[:256]])
                mask_quality = float(np.clip(mask_scores[i], 0, 1))
                values = depth[mask.astype(bool)]
                if values.size:
                    median = float(np.median(values))
                    dispersion = float(np.median(np.abs(values - median)))
            if median is None:
                values = depth[max(0, int(y1)):max(1, int(y2)), max(0, int(x1)):max(1, int(x2))]
                if values.size:
                    median = float(np.median(values))
                    dispersion = float(np.median(np.abs(values - median)))
            subjects.append({'id': track_id, 'classLabel': label, 'classConfidence': score, 'bbox': [x1 / width, y1 / height, (x2 - x1) / width, (y2 - y1) / height], 'mask': polygons, 'maskConfidence': mask_quality, 'center2D': {'x': (x1 + x2) / (2 * width), 'y': (y1 + y2) / (2 * height)}, 'depthRaw': median, 'depthSpread': dispersion, 'confidence': score, 'visibility': 1, 'stateFlags': ['observed'], 'heading': None, 'velocity': None, 'acceleration': None})
        frames.append({'time': timestamp, 'frameIndex': max(0, round(timestamp * source_fps)), 'subjects': subjects, 'depthMap': {'width': 32, 'height': thumb_height, 'rect': [0, top / height, 1, (bottom - top) / height], 'values': thumb.flatten().tolist()}, 'events': [], 'diagnostics': {'inferenceMs': (time.monotonic() - inference_start) * 1000, 'subjects': len(subjects), 'missingMasks': sum(not s['mask'] for s in subjects)}})
        progress('analyzing', done=index + 1, total=total, subjects=len(subjects), elapsedSeconds=time.monotonic() - started)
    cap.release()
    if not frames:
        raise ValueError('No frames could be decoded')
    low, high = np.percentile(depth_values, [10, 90])
    spread = max(.0001, high - low)
    history = {}
    for frame in frames:
        frame['depthMap']['values'] = [round(float(np.clip((v - low) / spread, 0, 1)), 3) for v in frame['depthMap']['values']]
        for subject in frame['subjects']:
            track = tracks[subject['id']]
            subject['classLabel'], subject['classConfidence'] = track['label'], track['classConfidence']
            raw, mad = subject.pop('depthRaw'), subject.pop('depthSpread')
            z = float(2 + 8 * (1 - np.clip((raw - low) / spread, 0, 1))) if raw is not None else None
            quality = float(np.clip(.65 - (mad or 0) / spread, .15, .65)) if z is not None else None
            subject['depthEstimate'] = {'value': z, 'confidence': quality, 'method': 'relative inverse depth / clip normalized'}
            x, _, bw, bh = subject['bbox']
            fx, fy = .9, .9 * width / height
            body_height = float(np.clip(bh * (z or 0) / fy, .15, 4)) if z is not None else 0
            subject['worldEstimate'] = {'x': float((subject['center2D']['x'] - .5) * z / fx), 'y': body_height / 2, 'z': z} if z is not None else None
            subject['volume'] = {'length': float(np.clip(bw * (z or 0) / fx, .2, 4)), 'height': body_height, 'width': float(np.clip(bw * (z or 0) / fx * .45, .15, 2)), 'confidence': .3}
            previous = history.get(subject['id'])
            if previous and frame['time'] - previous[0] <= .65 and subject['worldEstimate'] and previous[1]['worldEstimate']:
                dt = frame['time'] - previous[0]
                a, b = previous[1]['worldEstimate'], subject['worldEstimate']
                velocity = {axis: (b[axis] - a[axis]) / dt for axis in ('x', 'y', 'z')}
                subject['velocity'] = {'x': velocity['x'], 'y': velocity['y'], 'z': velocity['z'], 'speed': math.sqrt(sum(v * v for v in velocity.values()))}
                prev_heading = previous[1]['heading']
                horizontal_speed = math.hypot(velocity['x'], velocity['z'])
                if horizontal_speed > .05:
                    angle = math.atan2(velocity['x'], velocity['z'])
                    if prev_heading is not None:
                        angle = math.atan2(.7 * math.sin(prev_heading) + .3 * math.sin(angle), .7 * math.cos(prev_heading) + .3 * math.cos(angle))
                    subject['heading'] = angle
                else:
                    subject['heading'] = prev_heading
                previous_velocity = previous[1]['velocity']
                if previous_velocity:
                    subject['acceleration'] = math.sqrt(sum(((velocity[axis] - previous_velocity[axis]) / dt) ** 2 for axis in ('x', 'y', 'z')))
            history[subject['id']] = (frame['time'], subject)
    cleaned_tracks = [{k: v for k, v in track.items() if k != 'votes'} for track in tracks.values()]
    result = {'frames': frames, 'tracks': cleaned_tracks, 'models': {k: {'id': v[0], 'revision': v[1]} for k, v in MODELS.items()}, 'runtime': {'device': device, 'seconds': time.monotonic() - started}, 'ground': {'method': 'assumed flat ground / uncalibrated pinhole', 'focalNormalized': .9, 'scale': 'relative scene units'}}
    output = Path(args.output)
    temporary = output.with_suffix('.tmp.json')
    temporary.write_text(json.dumps(result, allow_nan=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(output)
    progress('complete', done=total, total=total, tracks=len(tracks))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        progress('error', error=str(error))
        raise
