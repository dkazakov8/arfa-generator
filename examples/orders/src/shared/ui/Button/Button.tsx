import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.css';

type PropsButton = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function Button({ children, variant = 'secondary', className, ...props }: PropsButton) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
