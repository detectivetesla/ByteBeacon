import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell, Container, Card, Alert, Button, Stack } from '../components/ui/index.js';

export const AuthenticatedLayoutPlaceholder: React.FC = () => {
  return (
    <PageShell>
      <Container maxWidth="md">
        <Stack gap={6}>
          <Alert variant="info" title="Security & Architecture Boundary">
            Authenticated customer portal and business flows are deferred to Phase 2.
          </Alert>
          <Card variant="elevated">
            <Stack gap={4}>
              <h2>Authenticated Customer Portal Shell</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                This placeholder establishes the routing and component boundary for future authenticated customer dashboards, wallet balances, and order histories.
              </p>
              <div>
                <Link to="/">
                  <Button variant="outline">Return to Home</Button>
                </Link>
              </div>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </PageShell>
  );
};
