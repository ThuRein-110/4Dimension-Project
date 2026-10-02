import type { Role, ServerSignal, Signal } from './protocol.js';

export type LinkState = 'connecting' | 'waiting' | 'negotiating' | 'live' | 'reconnecting' | 'closed';
interface Options {
  role: Role; id: string; token: string; stream?: MediaStream;
  onState: (state: LinkState) => void;
  onStream?: (stream: MediaStream) => void;
  onTelemetry?: (message: Extract<Signal, { type: 'telemetry' }>) => void;
  onError: (message: string) => void;
}

export class PeerLink {
  private socket?: WebSocket;
  private peer?: RTCPeerConnection;
  private candidates: RTCIceCandidateInit[] = [];
  private retryTimer?: ReturnType<typeof setTimeout>;
  private disconnectTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private attempt = 0;
  private messages: Promise<void> = Promise.resolve();
  constructor(private options: Options) { this.connect(); }
  send(message: Signal) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  private connect() {
    if (this.stopped) return;
    this.options.onState(this.attempt ? 'reconnecting' : 'connecting');
    const url = new URL('/signal', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.search = new URLSearchParams({ id: this.options.id, token: this.options.token, role: this.options.role }).toString();
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.onmessage = event => {
      this.messages = this.messages.then(async () => {
        if (this.stopped || this.socket !== ws) return;
        await this.handle(JSON.parse(event.data) as ServerSignal);
      }).catch(error => {
        this.options.onError(error instanceof Error ? error.message : 'WebRTC negotiation failed');
        this.scheduleNegotiation();
      });
    };
    ws.onopen = () => { this.attempt = 0; this.options.onState('waiting'); };
    ws.onerror = () => this.options.onError('Signaling unavailable. Check pairing, Wi-Fi, and HTTPS trust.');
    ws.onclose = event => {
      if (this.stopped) return;
      this.resetPeer();
      if (event.code === 4003) {
        this.options.onError('Pairing expired. Generate a new QR code on Windows.'); this.close(); return;
      }
      this.options.onState('reconnecting');
      this.retryTimer = setTimeout(() => this.connect(), Math.min(1000 * 2 ** this.attempt++, 10000));
    };
  }
  private resetPeer() {
    clearTimeout(this.disconnectTimer);
    if (this.peer) {
      this.peer.onconnectionstatechange = null;
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.close();
    }
    this.peer = undefined;
    this.candidates = [];
  }
  private makePeer() {
    this.resetPeer();
    const peer = new RTCPeerConnection({ iceServers: [] });
    this.peer = peer;
    let received: MediaStream | undefined;
    peer.onicecandidate = event => {
      if (event.candidate) { const candidate = event.candidate.toJSON(); this.send({ type: 'ice', candidate: { ...candidate, candidate: candidate.candidate ?? '' } }); }
    };
    peer.ontrack = event => { received = event.streams[0] ?? new MediaStream([event.track]); this.options.onStream?.(received); };
    peer.onconnectionstatechange = () => {
      clearTimeout(this.disconnectTimer);
      if (peer.connectionState === 'connected') { this.options.onState('live'); if (received) this.options.onStream?.(received); }
      if (peer.connectionState === 'failed') this.scheduleNegotiation();
      if (peer.connectionState === 'disconnected') {
        this.options.onState('reconnecting');
        this.disconnectTimer = setTimeout(() => this.scheduleNegotiation(), 4000);
      }
    };
    if (this.options.role === 'camera') {
      this.options.stream?.getTracks().forEach(track => peer.addTrack(track, this.options.stream!));
    }
    this.options.onState('negotiating');
    return peer;
  }
  private scheduleNegotiation() {
    if (this.stopped) return;
    this.options.onState('reconnecting');
    clearTimeout(this.disconnectTimer);
    this.disconnectTimer = setTimeout(() => {
      if (this.options.role === 'desktop') this.send({ type: 'ready' });
      else this.messages = this.messages.then(() => this.offer()).catch(error => this.options.onError(String(error)));
    }, 1000);
  }
  private async offer() {
    const peer = this.makePeer();
    const offer = await peer.createOffer();
    if (this.stopped || this.peer !== peer) return;
    await peer.setLocalDescription(offer);
    this.send({ type: 'offer', sdp: offer.sdp! });
  }
  private async flushCandidates() {
    const peer = this.peer;
    if (!peer?.remoteDescription) return;
    for (const candidate of this.candidates.splice(0)) await peer.addIceCandidate(candidate);
  }
  private async handle(message: ServerSignal) {
    switch (message.type) {
      case 'peer-ready': case 'ready':
        if (this.options.role === 'camera') await this.offer();
        break;
      case 'peer-left': this.resetPeer(); this.options.onState('waiting'); break;
      case 'offer': {
        if (this.options.role !== 'desktop') break;
        const queued = this.candidates;
        const peer = this.makePeer();
        this.candidates = queued;
        await peer.setRemoteDescription({ type: 'offer', sdp: message.sdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        this.send({ type: 'answer', sdp: answer.sdp! });
        await this.flushCandidates();
        break;
      }
      case 'answer':
        if (this.options.role === 'camera' && this.peer?.signalingState === 'have-local-offer') {
          await this.peer.setRemoteDescription({ type: 'answer', sdp: message.sdp });
          await this.flushCandidates();
        }
        break;
      case 'ice':
        if (this.peer?.remoteDescription) await this.peer.addIceCandidate(message.candidate);
        else this.candidates.push(message.candidate);
        break;
      case 'telemetry': this.options.onTelemetry?.(message); break;
      case 'error': this.options.onError(message.message); break;
    }
  }
  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.resetPeer();
    this.socket?.close(1000, 'User disconnected');
    this.options.onState('closed');
  }
}
