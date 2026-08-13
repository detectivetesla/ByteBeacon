import React from 'react';
import styles from './BentoCard.module.css';

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  tag?: string;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  title,
  tag,
  colSpan = 1,
  rowSpan = 1,
  footer,
  className = '',
  children,
  ...props
}) => {
  const colClass = styles[`colSpan${colSpan}`];
  const rowClass = styles[`rowSpan${rowSpan}`];
  const cardClass = `${styles.bentoCard} ${colClass} ${rowClass} ${className}`.trim();

  return (
    <div className={cardClass} {...props}>
      {(title || tag) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {tag && <span className={styles.tag}>{tag}</span>}
        </div>
      )}
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
};
