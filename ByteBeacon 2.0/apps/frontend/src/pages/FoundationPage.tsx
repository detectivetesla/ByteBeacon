import React from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  BentoCard,
  Badge,
  Spinner,
  Alert,
  Divider,
  Stack,
  Grid,
} from '../components/ui/index.js';

export const FoundationPage: React.FC = () => {
  return (
    <Stack gap={8}>
      <div>
        <Badge variant="cyan">Phase 1 Foundation</Badge>
        <h1 style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          ByteBeacon Design System & Architecture Shell
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '720px' }}>
          Clean-slate technical baseline for ByteBeacon 2.0. This page showcases the WCAG 2.2 Level AA
          accessible UI primitives, design tokens (Obsidian, Cyan, Lime), and layout foundation.
        </p>
      </div>

      <Divider />

      <section aria-labelledby="tokens-heading">
        <h2 id="tokens-heading" style={{ marginBottom: '1.5rem' }}>
          Bento Grid Composition & Cards
        </h2>
        <Grid cols={3} gap={6}>
          <BentoCard
            title="Clean Architecture"
            tag="Security"
            colSpan={2}
            footer={<Badge variant="success">PostgreSQL & Redis Ready</Badge>}
          >
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Separation of concerns between Fastify backend, isolated provider abstractions, and safe shared contracts.
            </p>
          </BentoCard>

          <BentoCard
            title="Argon2id"
            tag="Cryptography"
            colSpan={1}
            footer={<Badge variant="cyan">OWASP Recommended</Badge>}
          >
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Benchmarked password hashing with memory and time cost controls.
            </p>
          </BentoCard>
        </Grid>
      </section>

      <section aria-labelledby="components-heading">
        <h2 id="components-heading" style={{ marginBottom: '1.5rem' }}>
          UI Primitives & Form Controls
        </h2>
        <Grid cols={2} gap={6}>
          <Card variant="elevated">
            <Stack gap={4}>
              <h3>Interactive Buttons & Badges</h3>
              <Stack direction="horizontal" gap={3} style={{ flexWrap: 'wrap' }}>
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="accent">Accent Lime</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger">Danger</Button>
              </Stack>
              <Stack direction="horizontal" gap={2} style={{ flexWrap: 'wrap' }}>
                <Badge variant="cyan">Cyan Accent</Badge>
                <Badge variant="lime">Lime Accent</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="neutral">Neutral</Badge>
              </Stack>
            </Stack>
          </Card>

          <Card variant="elevated">
            <Stack gap={4}>
              <h3>Accessible Form Inputs</h3>
              <Input
                label="Sample Email"
                placeholder="user@example.com"
                helperText="Enter a valid email address"
              />
              <Select
                label="Select Network"
                options={[
                  { label: 'MTN Ghana', value: 'MTN' },
                  { label: 'Telecel Ghana', value: 'TELECEL' },
                  { label: 'AT Ghana (AirtelTigo)', value: 'AIRTELTIGO' },
                ]}
              />
              <Textarea
                label="System Metadata Notes"
                placeholder="Optional notes..."
              />
            </Stack>
          </Card>
        </Grid>
      </section>

      <section aria-labelledby="status-heading">
        <h2 id="status-heading" style={{ marginBottom: '1.5rem' }}>
          System Telemetry & Alerts
        </h2>
        <Stack gap={4}>
          <Alert variant="info" title="Liveness & Readiness Active">
            Backend health probes are operational at <code>/healthz</code> and <code>/readyz</code>.
          </Alert>
          <Stack direction="horizontal" gap={3}>
            <Spinner size="sm" />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Continuous monitoring active.
            </span>
          </Stack>
        </Stack>
      </section>
    </Stack>
  );
};
