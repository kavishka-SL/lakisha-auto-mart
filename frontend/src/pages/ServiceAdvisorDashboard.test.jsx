import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import ServiceAdvisorDashboard from './ServiceAdvisorDashboard';

jest.mock('axios');

test('advisor moves from registration through assignment and returns for the next vehicle', async () => {
  window.scrollTo = jest.fn();
  let registered = false;
  let inspected = false;
  let assigned = false;

  axios.get.mockImplementation(url => {
    if (url.endsWith('/pending-registrations')) return Promise.resolve({ data: { success: true, registrations: registered ? [] : [
      { vehicleId: 'VID_TEST', customerId: 'CUST_TEST', customerName: 'Test Customer', registrationNo: 'TEST-1234' }
    ] } });
    if (url.endsWith('/vehicles')) return Promise.resolve({ data: { success: true, vehicles: [
      { vehicleId: 'VID_TEST', registrationNo: 'TEST-1234', make: 'Toyota', model: 'Corolla', status: registered ? 'REGISTERED' : 'PENDING_ADVISOR', isFullyClosed: false }
    ] } });
    if (url.endsWith('/requests')) return Promise.resolve({ data: { success: true, requests: inspected ? [
      { requestId: 'REQ_TEST', registrationNo: 'TEST-1234', isFullyClosed: false }
    ] : [] } });
    if (url.endsWith('/technicians')) return Promise.resolve({ data: { success: true, technicians: [
      { userId: 'TECH_TEST', name: 'Test Technician' }
    ] } });
    if (url.endsWith('/spare-parts')) return Promise.resolve({ data: { success: true, items: [
      { itemId: 'PART_TEST', itemName: 'Test Part', quantityInStock: 5, unitPrice: 100 }
    ] } });
    if (url.endsWith('/job-progress')) return Promise.resolve({ data: { success: true, progress: assigned ? [
      { jobCardId: 'JOB_TEST', registrationNo: 'TEST-1234', stageName: 'Stage 1', isFullyClosed: false }
    ] : [] } });
    if (url.endsWith('/reassign-mods-data')) return Promise.resolve({ data: { success: true, completedJobs: [], pendingMods: [] } });
    throw new Error(`Unexpected GET ${url}`);
  });
  axios.put.mockImplementation(() => { registered = true; return Promise.resolve({ data: { success: true, vehicleId: 'VID_TEST' } }); });
  axios.post.mockImplementation((url, body) => {
    if (url.endsWith('/inspection-report')) {
      expect(body).not.toHaveProperty('isCustomModification');
      inspected = true;
      return Promise.resolve({ data: { success: true, requestId: 'REQ_TEST' } });
    }
    if (url.endsWith('/assign-technician')) { assigned = true; return Promise.resolve({ data: { success: true, jobCardId: 'JOB_TEST' } }); }
    if (url.endsWith('/assign-spare-parts')) return Promise.resolve({ data: { success: true, message: 'Part allocated.' } });
    throw new Error(`Unexpected POST ${url}`);
  });

  render(<ServiceAdvisorDashboard user={{ userId: 'ADV_TEST' }} />);
  await screen.findByRole('option', { name: 'Test Customer (CUST_TEST)' });
  const registrationForm = screen.getByRole('button', { name: 'Complete Registration' }).closest('form');
  fireEvent.change(registrationForm.querySelector('select'), { target: { value: 'CUST_TEST' } });
  fireEvent.change(registrationForm.querySelector('input[placeholder="e.g., Toyota"]'), { target: { value: 'Toyota' } });
  fireEvent.change(registrationForm.querySelector('input[placeholder="e.g., Corolla"]'), { target: { value: 'Corolla' } });
  fireEvent.click(within(registrationForm).getByRole('button', { name: 'Complete Registration' }));

  await screen.findByText('Create Inspection Report');
  const inspectionForm = screen.getByRole('button', { name: 'Save Inspection Report' }).closest('form');
  expect(inspectionForm.querySelector('select').value).toBe('VID_TEST');
  expect(inspectionForm.querySelector('input[type="checkbox"]')).toBeNull();
  fireEvent.change(inspectionForm.querySelector('input[type="number"]'), { target: { value: '4000' } });
  fireEvent.click(within(inspectionForm).getByRole('button', { name: 'Save Inspection Report' }));

  await screen.findByRole('heading', { name: 'Assign Technician' });
  const technicianForm = screen.getByRole('button', { name: 'Assign Technician' }).closest('form');
  expect(technicianForm.querySelector('select').value).toBe('REQ_TEST');
  fireEvent.change(technicianForm.querySelectorAll('select')[2], { target: { value: 'TECH_TEST' } });
  fireEvent.click(within(technicianForm).getByRole('button', { name: 'Assign Technician' }));

  await screen.findByRole('button', { name: 'Finish Assignment & Register Next Vehicle' });
  const partsForm = screen.getByRole('button', { name: 'Allocate Part' }).closest('form');
  expect(partsForm.querySelector('select').value).toBe('JOB_TEST');
  fireEvent.change(partsForm.querySelectorAll('select')[1], { target: { value: 'PART_TEST' } });
  fireEvent.click(within(partsForm).getByRole('button', { name: 'Allocate Part' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/sa/assign-spare-parts', expect.objectContaining({ jobCardId: 'JOB_TEST', itemId: 'PART_TEST' })));
  expect(partsForm.querySelector('select').value).toBe('JOB_TEST');

  fireEvent.click(screen.getByRole('button', { name: 'Finish Assignment & Register Next Vehicle' }));
  await screen.findByText('Complete Vehicle Registration');
});
