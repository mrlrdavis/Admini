import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { createElement } from 'react';

// Mock dependencies
vi.mock('../../src/services/captureService', () => ({
  saveCapture: vi.fn().mockResolvedValue({ id: 'cap-1', text: '', mode: 'tap', status: 'synced', createdAt: '' }),
}));

vi.mock('../../src/components/Toast', () => ({
  showToast: vi.fn(),
}));

import { ObservationsTab } from '../../src/components/ObservationsTab';
import { saveCapture } from '../../src/services/captureService';
import { showToast } from '../../src/components/Toast';

describe('ObservationsTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial rendering', () => {
    it('renders the header and empty state', () => {
      const { getByText } = render(createElement(ObservationsTab));
      expect(getByText('Observations')).toBeDefined();
      expect(getByText('Track student and staff observations')).toBeDefined();
      expect(getByText('No observations yet')).toBeDefined();
    });

    it('shows "No roster uploaded" when no roster in localStorage', () => {
      const { getByText } = render(createElement(ObservationsTab));
      expect(getByText('No roster uploaded')).toBeDefined();
    });

    it('renders the student text input when no roster is loaded', () => {
      const { container } = render(createElement(ObservationsTab));
      const input = container.querySelector('input[placeholder="Student name..."]');
      expect(input).not.toBeNull();
    });

    it('renders all category pills', () => {
      const { getByText } = render(createElement(ObservationsTab));
      const categories = ['Behavior', 'Academic', 'Social', 'Emotional', 'Physical', 'Attendance', 'General'];
      for (const cat of categories) {
        expect(getByText(cat)).toBeDefined();
      }
    });

    it('renders save button disabled initially', () => {
      const { getByText } = render(createElement(ObservationsTab));
      const btn = getByText('Save Observation') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe('loading data from localStorage', () => {
    it('loads roster from localStorage on mount', () => {
      localStorage.setItem('admini_roster', JSON.stringify(['Alice', 'Bob']));
      const { getByText } = render(createElement(ObservationsTab));
      expect(getByText('2 students loaded')).toBeDefined();
    });

    it('renders a select dropdown when roster is loaded', () => {
      localStorage.setItem('admini_roster', JSON.stringify(['Alice', 'Bob']));
      const { container, getByText } = render(createElement(ObservationsTab));
      const select = container.querySelector('select');
      expect(select).not.toBeNull();
      expect(getByText('Alice')).toBeDefined();
      expect(getByText('Bob')).toBeDefined();
    });

    it('loads observations from localStorage on mount', () => {
      const obs = [{
        id: '1', student: 'Alice', category: 'Behavior',
        note: 'Great participation', observer: 'Teacher',
        timestamp: '10:00 AM', createdAt: '2024-06-01T10:00:00Z',
      }];
      localStorage.setItem('admini_observations', JSON.stringify(obs));
      const { getByText } = render(createElement(ObservationsTab));
      expect(getByText('Great participation')).toBeDefined();
    });
  });

  describe('roster upload', () => {
    it('parses CSV file and updates roster', async () => {
      const csvContent = 'Name,Grade\nAlice,5\nBob,6\nCharlie,5\n';
      const file = new File([csvContent], 'roster.csv', { type: 'text/csv' });

      const { container, getByText } = render(createElement(ObservationsTab));
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
        // Wait for FileReader to process
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(getByText('3 students loaded')).toBeDefined();
      expect(showToast).toHaveBeenCalledWith('Roster uploaded: 3 students');
      expect(JSON.parse(localStorage.getItem('admini_roster')!)).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('saving observations', () => {
    it('saves an observation with student and note', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userId: 'user-1', organizationId: 'org-1', userName: 'Teacher' })
      );

      const studentInput = getByPlaceholderText('Student name...');
      const noteInput = getByPlaceholderText('What did you observe?');

      await act(async () => {
        fireEvent.change(studentInput, { target: { value: 'Alice' } });
        fireEvent.change(noteInput, { target: { value: 'Excellent teamwork' } });
      });

      const saveBtn = getByText('Save Observation') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);

      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(getByText('Alice')).toBeDefined();
      expect(getByText('Excellent teamwork')).toBeDefined();
      expect(showToast).toHaveBeenCalledWith('Observation saved for Alice');
    });

    it('defaults category to General when none selected', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userName: 'Teacher' })
      );

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Bob' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Late arrival' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      const stored = JSON.parse(localStorage.getItem('admini_observations')!);
      expect(stored[0].category).toBe('General');
    });

    it('uses selected category when a pill is clicked', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userName: 'Teacher' })
      );

      await act(async () => {
        fireEvent.click(getByText('Academic'));
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Charlie' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Aced the test' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      const stored = JSON.parse(localStorage.getItem('admini_observations')!);
      expect(stored[0].category).toBe('Academic');
    });

    it('clears form fields after saving', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userName: 'Teacher' })
      );

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Good work' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      const studentInput = getByPlaceholderText('Student name...') as HTMLInputElement;
      const noteInput = getByPlaceholderText('What did you observe?') as HTMLTextAreaElement;
      expect(studentInput.value).toBe('');
      expect(noteInput.value).toBe('');
    });

    it('does not save when student is empty', async () => {
      const { getByText, getByPlaceholderText } = render(createElement(ObservationsTab));

      await act(async () => {
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Something' } });
      });

      const saveBtn = getByText('Save Observation') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });

    it('does not save when note is empty', async () => {
      const { getByText, getByPlaceholderText } = render(createElement(ObservationsTab));

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
      });

      const saveBtn = getByText('Save Observation') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });

    it('persists observation to localStorage', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userName: 'Teacher' })
      );

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Test note' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      const stored = JSON.parse(localStorage.getItem('admini_observations')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].student).toBe('Alice');
      expect(stored[0].note).toBe('Test note');
      expect(stored[0].observer).toBe('Teacher');
    });

    it('calls saveCapture when userId and organizationId are provided', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userId: 'user-1', organizationId: 'org-1', userName: 'Teacher' })
      );

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Good behavior' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      expect(saveCapture).toHaveBeenCalledWith({
        organizationId: 'org-1',
        userId: 'user-1',
        text: expect.stringContaining('[Observation] Alice (General): Good behavior'),
        mode: 'tap',
      });
    });

    it('does not call saveCapture when userId or organizationId is missing', async () => {
      const { getByText, getByPlaceholderText } = render(
        createElement(ObservationsTab, { userName: 'Teacher' })
      );

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Test' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      expect(saveCapture).not.toHaveBeenCalled();
    });

    it('sets observer to "Unknown" when userName is not provided', async () => {
      const { getByText, getByPlaceholderText } = render(createElement(ObservationsTab));

      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Note' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      const stored = JSON.parse(localStorage.getItem('admini_observations')!);
      expect(stored[0].observer).toBe('Unknown');
    });
  });

  describe('category pill toggle', () => {
    it('toggles category off when clicked again', async () => {
      const { getByText, getByPlaceholderText } = render(createElement(ObservationsTab));

      await act(async () => {
        fireEvent.click(getByText('Social'));
      });

      // Click again to deselect
      await act(async () => {
        fireEvent.click(getByText('Social'));
      });

      // Save and verify defaults to General
      await act(async () => {
        fireEvent.change(getByPlaceholderText('Student name...'), { target: { value: 'Alice' } });
        fireEvent.change(getByPlaceholderText('What did you observe?'), { target: { value: 'Test' } });
      });

      await act(async () => {
        fireEvent.click(getByText('Save Observation'));
      });

      const stored = JSON.parse(localStorage.getItem('admini_observations')!);
      expect(stored[0].category).toBe('General');
    });
  });

  describe('delete observation', () => {
    it('removes observation from list and localStorage', async () => {
      const obs = [{
        id: '1', student: 'Alice', category: 'Behavior',
        note: 'Great job', observer: 'Teacher',
        timestamp: '10:00 AM', createdAt: '2024-06-01T10:00:00Z',
      }];
      localStorage.setItem('admini_observations', JSON.stringify(obs));

      const { getByLabelText, queryByText } = render(createElement(ObservationsTab));
      expect(queryByText('Great job')).not.toBeNull();

      await act(async () => {
        fireEvent.click(getByLabelText('Delete observation'));
      });

      expect(queryByText('Great job')).toBeNull();
      expect(queryByText('No observations yet')).not.toBeNull();
      const stored = JSON.parse(localStorage.getItem('admini_observations')!);
      expect(stored).toHaveLength(0);
    });
  });

  describe('filter by student', () => {
    it('shows filter dropdown when roster and observations exist', () => {
      localStorage.setItem('admini_roster', JSON.stringify(['Alice', 'Bob']));
      localStorage.setItem('admini_observations', JSON.stringify([{
        id: '1', student: 'Alice', category: 'General',
        note: 'Note 1', observer: 'Teacher',
        timestamp: '10:00 AM', createdAt: '2024-06-01T10:00:00Z',
      }]));

      const { getByText } = render(createElement(ObservationsTab));
      expect(getByText('All Students')).toBeDefined();
    });

    it('filters observations by selected student', async () => {
      localStorage.setItem('admini_roster', JSON.stringify(['Alice', 'Bob']));
      localStorage.setItem('admini_observations', JSON.stringify([
        { id: '1', student: 'Alice', category: 'General', note: 'Alice note', observer: 'T', timestamp: '10:00', createdAt: '2024-06-01T10:00:00Z' },
        { id: '2', student: 'Bob', category: 'General', note: 'Bob note', observer: 'T', timestamp: '11:00', createdAt: '2024-06-01T11:00:00Z' },
      ]));

      const { container, queryByText } = render(createElement(ObservationsTab));

      // Find the filter select (in the filter section)
      const filterSelect = container.querySelector('.observations-tab__filter select') as HTMLSelectElement;

      await act(async () => {
        fireEvent.change(filterSelect, { target: { value: 'Alice' } });
      });

      expect(queryByText('Alice note')).not.toBeNull();
      expect(queryByText('Bob note')).toBeNull();
    });
  });

  describe('observations list display', () => {
    it('shows at most 20 observations', () => {
      const obs = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        student: 'Student',
        category: 'General',
        note: `Note ${i}`,
        observer: 'Teacher',
        timestamp: '10:00 AM',
        createdAt: '2024-06-01T10:00:00Z',
      }));
      localStorage.setItem('admini_observations', JSON.stringify(obs));

      const { container } = render(createElement(ObservationsTab));
      const cards = container.querySelectorAll('.observations-tab__observation-card');
      expect(cards.length).toBe(20);
    });

    it('renders observation card with student name, category badge, and note', () => {
      const obs = [{
        id: '1', student: 'Alice', category: 'Academic',
        note: 'Strong performance', observer: 'Teacher',
        timestamp: '10:00 AM', createdAt: '2024-06-01T10:00:00Z',
      }];
      localStorage.setItem('admini_observations', JSON.stringify(obs));

      const { container, getByText } = render(createElement(ObservationsTab));
      expect(getByText('Alice')).toBeDefined();
      // 'Academic' appears both as pill and badge
      const badge = container.querySelector('.observations-tab__category-badge');
      expect(badge?.textContent).toBe('Academic');
      expect(getByText('Strong performance')).toBeDefined();
      expect(getByText('Teacher')).toBeDefined();
    });
  });
});
