import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { RegisterPage } from './RegisterPage';

describe('RegisterPage', () => {
  it('renders the registration form', () => {
    renderWithProviders(<RegisterPage />, {
      routerProps: { initialEntries: ['/'] },
    });

    expect(screen.getByText('Membership Application')).toBeInTheDocument();
  });

  it('has all required form fields', () => {
    renderWithProviders(<RegisterPage />, {
      routerProps: { initialEntries: ['/'] },
    });

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByLabelText('Gender')).toBeInTheDocument();
    expect(screen.getByLabelText('Street Address')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByLabelText('Zip Code')).toBeInTheDocument();
  });

  it('has submit button initially disabled (no captcha)', () => {
    renderWithProviders(<RegisterPage />, {
      routerProps: { initialEntries: ['/'] },
    });

    const submitButton = screen.getByRole('button', { name: /submit application/i });
    expect(submitButton).toBeDisabled();
  });

  it('shows DL verification disclaimer', () => {
    renderWithProviders(<RegisterPage />, {
      routerProps: { initialEntries: ['/'] },
    });

    expect(
      screen.getByText(/exactly as they appear on your driver's license/i),
    ).toBeInTheDocument();
  });

  it('has links to login and admin pages', () => {
    renderWithProviders(<RegisterPage />, {
      routerProps: { initialEntries: ['/'] },
    });

    expect(screen.getByText('Already a member?')).toBeInTheDocument();
    expect(screen.getByText('Admin login')).toBeInTheDocument();
  });
});
