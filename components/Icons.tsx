import React from 'react';

export const PlantIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 20h10" />
    <path d="M10 20c0-3.3 1-6.7 3-10" />
    <path d="M14 20c0-3.3-1-6.7-3-10" />
    <path d="M12 10c2 0 4-2 4-4a4 4 0 0 0-8 0c0 2 2 4 4 4z" />
    <path d="M12 10v10" />
  </svg>
);

export const SendIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

export const UploadIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.5 10.5a.75.75 0 000 1.06l3.159 3.159a.75.75 0 001.06 0l10.5-10.5a2.25 2.25 0 000-3.182zM5.25 12.06l7.5-7.5 3.159 3.159-7.5 7.5-3.159-3.159zM18 3.75a.75.75 0 00-1.06 0l-3.182 3.182a.75.75 0 001.06 1.061L18 4.811A.75.75 0 0018 3.75zM6 15.75a.75.75 0 00-1.06 0l-3.182 3.182a.75.75 0 001.06 1.061L6 16.811A.75.75 0 006 15.75z"
      clipRule="evenodd"
    />
  </svg>
);

export const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.678 18.678 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
  </svg>
);

export const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M7.502 6.002C7.502 4.345 8.847 3 10.502 3h3.001c1.654 0 2.999 1.345 2.999 3.002v3.001c0 1.654-1.345 2.999-2.999 2.999h-3.001C8.847 12.002 7.502 10.657 7.502 9.003V6.002zM11.252 4.502a.75.75 0 01.75-.75h.001a.75.75 0 01.75.75v.001a.75.75 0 01-.75.75h-.001a.75.75 0 01-.75-.75V4.502z" clipRule="evenodd" />
    <path d="M9.002 15.003c0-1.216.984-2.2 2.2-2.2h1.6c1.216 0 2.2.984 2.2 2.2v4.286c0 .345-.28.625-.625.625h-4.75a.625.625 0 01-.625-.625V15.003z" />
    <path fillRule="evenodd" d="M2.576 11.332a.75.75 0 01.884-.316l2.316.87a.75.75 0 01-.316.884l-2.316-.87a.75.75 0 01-.568-.568zM17.424 11.332a.75.75 0 01.568-.568l2.316.87a.75.75 0 01-.316.884l-2.316-.87a.75.75 0 01-.252-.316zM5.502 18.003a.75.75 0 01.75-.75h.001a.75.75 0 01.75.75v.001a.75.75 0 01-.75.75h-.001a.75.75 0 01-.75-.75V18.003zM16.502 18.003a.75.75 0 01.75-.75h.001a.75.75 0 01.75.75v.001a.75.75 0 01-.75.75h-.001a.75.75 0 01-.75-.75V18.003z" clipRule="evenodd" />
  </svg>
);

export const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);
  
export const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.144-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.057-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);
  
export const MenuIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);
  
export const CloseIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);