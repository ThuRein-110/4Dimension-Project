import { RefreshCw } from 'lucide-react';
import type { WebcamController, WebcamSnapshot } from './WebcamController.js';

export function WebcamDeviceSelect({ controller, state }: { controller: WebcamController; state: WebcamSnapshot }) {
  return <div className="webcam-device-select"><label>Camera<select aria-label="Webcam device" value={state.deviceId} disabled={state.requesting} onChange={event => controller.selectDevice(event.target.value)}>
    <option value="">Browser default</option>
    {state.devices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
  </select></label><button title="Refresh cameras" aria-label="Refresh cameras" disabled={state.requesting} onClick={() => void controller.refreshDevices()}><RefreshCw size={15} /></button></div>;
}
