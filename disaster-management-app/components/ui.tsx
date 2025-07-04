
import React, { ReactNode, useEffect } from 'react';

// Icon Component
interface IconProps {
  name: string;
  className?: string;
}
export const Icon: React.FC<IconProps> = ({ name, className }) => (
  <i className={`fas ${name} ${className || ''}`}></i>
);

// Card Component
export const GlassCard: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
    <div className={`bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30 p-6 ${className}`}>
        {children}
    </div>
);

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', size = 'md', isLoading = false, ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center border border-transparent font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md";
    
    const variantClasses = {
      primary: 'bg-blue-600/80 text-white hover:bg-blue-600 border-blue-700 focus:ring-blue-500 backdrop-blur-sm',
      secondary: 'bg-white/20 text-slate-900 hover:bg-white/40 focus:ring-slate-500 border-white/30 backdrop-blur-sm',
      danger: 'bg-red-600/80 text-white hover:bg-red-700 border-red-700 focus:ring-red-500 backdrop-blur-sm',
      ghost: 'bg-transparent text-slate-800 hover:bg-white/20 focus:ring-slate-500 shadow-none',
    };

    const sizeClasses = {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    return (
      <button ref={ref} className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`} disabled={isLoading} {...props}>
        {isLoading ? <Spinner className="w-5 h-5 text-current" /> : children}
      </button>
    );
  }
);

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, ...props }, ref) => (
    <div>
        {label && <label htmlFor={id} className="block text-sm font-medium text-slate-800 mb-1">{label}</label>}
        <input
            ref={ref}
            id={id}
            className="mt-1 block w-full px-3 py-2 bg-white/20 border border-white/40 rounded-lg text-sm shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 disabled:bg-slate-50/50 disabled:text-slate-500 disabled:border-slate-200 backdrop-blur-sm"
            {...props}
        />
    </div>
));

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, id, ...props }, ref) => (
    <div>
        {label && <label htmlFor={id} className="block text-sm font-medium text-slate-800 mb-1">{label}</label>}
        <textarea
            ref={ref}
            id={id}
            className="mt-1 block w-full px-3 py-2 bg-white/20 border border-white/40 rounded-lg text-sm shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 backdrop-blur-sm"
            {...props}
        />
    </div>
));

// Select Component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    children: ReactNode;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ label, id, children, ...props }, ref) => (
    <div>
        {label && <label htmlFor={id} className="block text-sm font-medium text-slate-800 mb-1">{label}</label>}
        <select
            ref={ref}
            id={id}
            className="mt-1 block w-full px-3 py-2 bg-white/20 border border-white/40 rounded-lg text-sm shadow-sm text-slate-900 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 backdrop-blur-sm"
            {...props}
        >
            {children}
        </select>
    </div>
));


// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, size = 'lg' }) => {
  if (!isOpen) return null;
  
  const sizeClasses = {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-md',
      lg: 'sm:max-w-lg',
      xl: 'sm:max-w-xl',
      '2xl': 'sm:max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto">
      <div className="flex items-center sm:items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>
        <div className={`inline-block align-bottom bg-white/60 backdrop-blur-xl border border-white/20 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} w-full z-50`}>
           <div className="p-6">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                        <Icon name="fa-times" className="text-2xl" />
                    </button>
                </div>
                <div className="mt-4">
                    {children}
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// Spinner Component
export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={`animate-spin h-5 w-5 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


// Toast component
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}
export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const baseClasses = 'fixed bottom-5 right-5 text-white py-3 px-5 rounded-xl shadow-lg z-50 transform transition-all duration-300 backdrop-blur-md border';
  const typeClasses = {
    success: 'bg-blue-500/80 border-blue-400',
    error: 'bg-red-500/80 border-red-400',
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      {message}
    </div>
  );
};


// Confirmation Modal
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger';
}
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'danger'}) => {
    if(!isOpen) return null;
    return (
         <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>
                <div className="bg-white/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl transform transition-all sm:max-w-md w-full z-50">
                    <div className="p-6 text-center">
                        <Icon name="fa-exclamation-triangle" className="text-4xl text-yellow-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                        <p className="mt-2 text-sm text-slate-700">{message}</p>
                    </div>
                    <div className="bg-black/10 px-6 py-4 flex justify-end space-x-4 rounded-b-2xl">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button variant={confirmVariant} onClick={onConfirm}>{confirmText}</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
