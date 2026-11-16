import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ralat tidak dijangka telah berlaku.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('VMS ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Ralat Sistem VMS</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Operasi tidak dapat diselesaikan kerana ralat akses atau rangkaian. Sila cuba muat semula halaman.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-all">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Cuba Semula
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
