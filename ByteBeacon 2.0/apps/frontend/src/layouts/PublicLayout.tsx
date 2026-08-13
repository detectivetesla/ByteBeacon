import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { PageShell, Container, Button, Badge } from '../components/ui/index.js';
import styles from './PublicLayout.module.css';

export const PublicLayout: React.FC = () => {
  const header = (
    <Container maxWidth="xl">
      <div className={styles.headerContent}>
        <div className={styles.logo}>
          <span>Byte<span className={styles.logoAccent}>Beacon</span></span>
          <Badge variant="cyan">2.0 Foundation</Badge>
        </div>
        <nav className={styles.navLinks} aria-label="Public Navigation">
          <Link to="/" className={styles.navLink}>Home</Link>
          <Link to="/auth/placeholder" className={styles.navLink}>Customer Area</Link>
          <Link to="/admin/placeholder" className={styles.navLink}>Admin Area</Link>
          <Button size="sm" variant="outline">
            Documentation
          </Button>
        </nav>
      </div>
    </Container>
  );

  const footer = (
    <Container maxWidth="xl">
      <div className={styles.footerContent}>
        <div>
          &copy; {new Date().getFullYear()} ByteBeacon. All rights reserved.
        </div>
        <div>
          <span>Phase 1 Clean-Slate Technical Foundation</span>
        </div>
      </div>
    </Container>
  );

  return (
    <PageShell header={header} footer={footer}>
      <Container maxWidth="xl">
        <Outlet />
      </Container>
    </PageShell>
  );
};
