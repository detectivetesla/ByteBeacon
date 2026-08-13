import React from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
  header,
  footer,
  children,
}) => {
  return (
    <div className={styles.shell}>
      {header && <header className={styles.header}>{header}</header>}
      <main className={styles.main}>{children}</main>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
};
