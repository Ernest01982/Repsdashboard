import { ButtonHTMLAttributes } from 'react';

export default function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button 
      {...rest} 
      className={`rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-black disabled:opacity-50 ${className}`} 
    />
  );
}