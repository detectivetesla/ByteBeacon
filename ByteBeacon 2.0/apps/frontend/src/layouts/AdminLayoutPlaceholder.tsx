import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell, Container, Card, Alert, Button, Stack } from '../components/ui/index.js';

export const AdminLayoutPlaceholder: React.FC = () => {
  return (
    <PageShell>
      <Container maxWidth="md">
        <Stack gap={6}>
          <Alert variant="warning" title="Privileged Access Boundary">
            Administrative portal and privileged management flows are deferred to Phase 2.
          </Alert>
          <Card variant="elevated">
            <Stack gap={4}>
              <h2>Admin Management Portal Shell</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                This placeholder establishes the isolated administration perimeter for future system telemetry, user audits, and reconciliation tools.
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
