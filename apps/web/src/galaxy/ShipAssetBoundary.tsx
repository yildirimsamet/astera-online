import { Component, type ReactNode } from 'react';

/** Keep model failures local, with bounded retries and recovery when connectivity returns. */
export class ShipAssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError?: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private automaticRetryUsed = false;
  private retry = () => {
    if (this.retryTimer !== null) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.state.failed) this.setState({ failed: false });
  };
  override componentDidMount() {
    window.addEventListener('online', this.retry);
    window.addEventListener('focus', this.retry);
  }
  override componentWillUnmount() {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    window.removeEventListener('online', this.retry);
    window.removeEventListener('focus', this.retry);
  }
  override componentDidCatch() {
    this.props.onError?.();
    // An online event can precede delivery of the failed fetch. One delayed retry covers that race.
    if (!this.automaticRetryUsed) {
      this.automaticRetryUsed = true;
      this.retryTimer = setTimeout(this.retry, 1_000);
    }
  }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
