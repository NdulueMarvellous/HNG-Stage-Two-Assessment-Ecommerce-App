import { Component } from 'react';
import Alert from './Feedback';

/**
 * Last line of defence: catches render errors (a bad payload, a missing field)
 * and shows a recoverable message instead of a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container-page py-20">
          <Alert
            variant="error"
            title="The page could not be displayed"
            onRetry={() => this.setState({ error: null })}
          >
            <p>{this.state.error.message || 'An unexpected error occurred.'}</p>
            <p className="mt-2 text-xs opacity-80">
              If this keeps happening, reload the page or check your Supabase configuration.
            </p>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}