import React from 'react';
import styles from './Container.module.css';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'fluid';
  children: React.ReactNode;
}

export const Container: React.FC<ContainerProps> = ({
  maxWidth = 'xl',
  className = '',
  children,
  ...props
}) => {
  const containerClass = `${styles.container} ${styles[maxWidth]} ${className}`.trim();
  return (
    <div className={containerClass} {...props}>
      {children}
    </div>
  );
};
