import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import OfficeDashboard from './OfficeDashboard';

jest.mock('axios');

test('office bills extra work and moves paid jobs out of the pending selector', async () => {
  let savedCharges = [];
  let paymentRecorded = false;
  const pendingJob = { jobCardId: 'JOB_PENDING', registrationNo: 'CA-9604', customerName: 'Test Customer', stageName: 'Stage 1' };
  const paidJob = { jobCardId: 'JOB_PAID', registrationNo: 'ABC-1234', customerName: 'Paid Customer', invoiceId: 'INV_PAID', grandTotal: 700 };

  axios.get.mockImplementation(url => {
    if (url.endsWith('/invoice-work')) return Promise.resolve({ data: {
      success: true, pending: paymentRecorded ? [] : [pendingJob],
      completed: paymentRecorded ? [paidJob, { ...pendingJob, invoiceId: 'INV_JOB_PENDING', grandTotal: 1500 }] : [paidJob]
    } });
    if (url.endsWith('/payment-history')) return Promise.resolve({ data: { success: true, payments: [
      { paymentId: 'PAY_1', paymentDate: '2026-10-14T09:00:00', registrationNo: 'ABC-1234', customerName: 'Paid Customer', invoiceId: 'INV_PAID', paymentMethod: 'CASH', amount: 700 }
    ] } });
    if (url.endsWith('/invoice-summary/JOB_PENDING')) return Promise.resolve({ data: {
      success: true, job: pendingJob, parts: [{ itemName: 'Part', quantityUsed: 1, pricePerUnit: 1000 }],
      charges: savedCharges, totals: { partsSubtotal: 1000 }
    } });
    throw new Error(`Unexpected GET ${url}`);
  });
  axios.put.mockImplementation((url, body) => {
    expect(url).toBe('http://localhost:5000/api/om/invoice-charges/JOB_PENDING');
    savedCharges = body.charges;
    return Promise.resolve({ data: { success: true } });
  });
  axios.post.mockImplementation((url, body) => {
    expect(url).toBe('http://localhost:5000/api/om/process-payment');
    expect(body).toMatchObject({ jobCardId: 'JOB_PENDING', paymentMethod: 'CASH', taxPercentage: 0 });
    expect(body).not.toHaveProperty('amount');
    paymentRecorded = true;
    return Promise.resolve({ data: { success: true, message: 'Payment recorded.' } });
  });

  render(<OfficeDashboard user={{ userId: 'U004', name: 'Office User' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Invoices & Payments' }));
  const selector = await screen.findByLabelText('Vehicle and customer');
  await screen.findByRole('option', { name: /CA-9604 — Test Customer/ });
  expect(selector.querySelector('option[value="JOB_PAID"]')).toBeNull();
  expect(screen.queryByRole('button', { name: /Print Invoice/ })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Completed & Paid Work' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Payment History' })).toBeTruthy();

  fireEvent.change(selector, { target: { value: 'JOB_PENDING' } });
  await screen.findByRole('heading', { name: /Invoice for CA-9604/ });
  fireEvent.click(screen.getByRole('button', { name: 'Add Charge' }));
  fireEvent.change(screen.getByLabelText('Charge type 1'), { target: { value: 'CUSTOM_MODIFICATION' } });
  fireEvent.change(screen.getByLabelText('Charge description 1'), { target: { value: 'Body kit fitting' } });
  fireEvent.change(screen.getByLabelText('Charge amount 1'), { target: { value: '500.00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Charges' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record Payment' }).disabled).toBe(false));
  expect(savedCharges[0]).toMatchObject({ chargeType: 'CUSTOM_MODIFICATION', description: 'Body kit fitting', amount: '500.00' });

  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(selector.querySelector('option[value="JOB_PENDING"]')).toBeNull());
});
