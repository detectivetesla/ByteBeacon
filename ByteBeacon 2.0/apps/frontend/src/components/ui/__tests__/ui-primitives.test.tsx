import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Card,
  BentoCard,
  Badge,
  Spinner,
  Alert,
  Modal,
  Divider,
  Container,
  Stack,
  Grid,
} from '../index.js';

describe('UI Primitives Foundation Tests', () => {
  it('renders Button and handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders IconButton with accessible aria-label', () => {
    render(<IconButton aria-label="Close Settings">X</IconButton>);
    const button = screen.getByRole('button', { name: /close settings/i });
    expect(button).toBeInTheDocument();
  });

  it('renders Input with label, helperText, and error state', () => {
    const { rerender } = render(
      <Input label="Phone Number" helperText="Enter 10 digits" />,
    );
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByText(/enter 10 digits/i)).toBeInTheDocument();

    rerender(<Input label="Phone Number" error="Invalid phone format" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid phone format/i);
  });

  it('renders Select with accessible label and options', () => {
    render(
      <Select
        label="Network Provider"
        options={[
          { label: 'MTN', value: 'mtn' },
          { label: 'Telecel', value: 'telecel' },
        ]}
      />,
    );
    expect(screen.getByLabelText(/network provider/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders Textarea with label', () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('renders Card and BentoCard with title and tag', () => {
    render(
      <Card variant="elevated">
        <div>Card Content</div>
      </Card>,
    );
    expect(screen.getByText(/card content/i)).toBeInTheDocument();

    render(
      <BentoCard title="Telecom Hub" tag="Infrastructure">
        <div>Bento Content</div>
      </BentoCard>,
    );
    expect(screen.getByText(/telecom hub/i)).toBeInTheDocument();
    expect(screen.getByText(/infrastructure/i)).toBeInTheDocument();
  });

  it('renders Badge, Spinner, Alert with accessibility roles', () => {
    render(<Badge variant="cyan">Active</Badge>);
    expect(screen.getByText(/active/i)).toBeInTheDocument();

    render(<Spinner label="Processing payment" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    render(<Alert variant="danger" title="Error Occurred">Payment failed</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
  });

  it('renders Modal and responds to Escape key and close button', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Modal Body</div>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/test modal/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('renders layout primitives: Divider, Container, Stack, Grid', () => {
    const { container } = render(
      <Container maxWidth="xl">
        <Stack direction="vertical" gap={4}>
          <Grid cols={3} gap={4}>
            <div>Item 1</div>
            <div>Item 2</div>
          </Grid>
          <Divider />
        </Stack>
      </Container>,
    );
    expect(screen.getByText(/item 1/i)).toBeInTheDocument();
    expect(container.querySelector('hr')).toBeInTheDocument();
  });
});
