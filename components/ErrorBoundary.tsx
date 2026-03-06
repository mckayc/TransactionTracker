import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from './Icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-3xl bg-red-50 border border-red-100 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ExclamationTriangleIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-red-800">Something went wrong</h2>
          <p className="text-sm text-red-600">The Business and Taxes module encountered an error.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
