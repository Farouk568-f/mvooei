import React, { useEffect, useState } from 'react';
import { useProfile } from '../contexts/ProfileContext';

export const ToastContainer: React.FC = () => {
  const { toast, setToast } = useProfile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (toast) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        // Allow animation to finish before clearing toast data
        setTimeout(() => setToast(null), 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, setToast]);

  if (!toast) {
    return null;
  }

  const baseStyle = "fixed bottom-20 md:top-20 md:bottom-auto left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-semibold shadow-lg z-50 transition-all duration-300 ease-out flex items-center gap-2";
  const typeStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };
  const visibilityStyle = show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10';

  return (
    <div className={`${baseStyle} ${typeStyles[toast.type]} ${visibilityStyle} glassmorphic-panel !bg-opacity-100`}>
      <i className={`fa-solid ${toast.type === 'success' ? 'fa-check-circle' : (toast.type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle')}`}></i>
      {toast.message}
    </div>
  );
};

export const useToast = () => {
    const { setToast } = useProfile();
    return setToast;
}