import { timetableApi, CopyDayRequest } from '../../../api/timetableApi';
import axiosInstance from '../../../utils/api';

// Mock axios and toast
jest.mock('../../../utils/api');
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedAxios = axiosInstance as jest.Mocked<typeof axiosInstance>;

describe('TimetableApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('copyDay', () => {
    const mockRequest: CopyDayRequest = {
      sourceDate: '2024-01-15',
      targetDate: '2024-01-16',
      curriculumId: 1,
      termId: 2,
      sectionId: 'A',
    };

    it('should successfully copy day', async () => {
      const mockResponse = { 
        data: { success: true, copiedClasses: 5 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await timetableApi.copyDay(mockRequest);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/timetable/copy-day', mockRequest);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Classes copied successfully');
    });

    it('should handle API error gracefully', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid date range' },
        },
      };
      mockedAxios.post.mockRejectedValue(mockError);

      const result = await timetableApi.copyDay(mockRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid date range');
    });

    it('should handle network error', async () => {
      const mockError = {
        request: {},
      };
      mockedAxios.post.mockRejectedValue(mockError);

      const result = await timetableApi.copyDay(mockRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error. Please check your connection and try again.');
    });
  });

  describe('resetTimetableDates', () => {
    const semTimeTableId = 123;

    it('should successfully reset timetable dates', async () => {
      const mockResponse = { 
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.patch.mockResolvedValue(mockResponse);

      const result = await timetableApi.resetTimetableDates(semTimeTableId);

      expect(mockedAxios.patch).toHaveBeenCalledWith(`/api/v1/timetable/${semTimeTableId}/reset-dates`);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Timetable dates reset successfully');
    });

    it('should handle 404 error', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { message: 'Timetable not found' },
        },
      };
      mockedAxios.patch.mockRejectedValue(mockError);

      const result = await timetableApi.resetTimetableDates(semTimeTableId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('The requested resource was not found.');
    });
  });

  describe('deleteTimetable', () => {
    const semTimeTableId = 123;

    it('should successfully delete timetable', async () => {
      const mockResponse = { 
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await timetableApi.deleteTimetable(semTimeTableId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(`/api/v1/timetable/${semTimeTableId}`);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Timetable deleted successfully');
    });

    it('should handle 403 permission error', async () => {
      const mockError = {
        response: {
          status: 403,
          data: { message: 'Permission denied' },
        },
      };
      mockedAxios.delete.mockRejectedValue(mockError);

      const result = await timetableApi.deleteTimetable(semTimeTableId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('You do not have permission to perform this action.');
    });
  });

  describe('getScheduledClasses', () => {
    it('should successfully get scheduled classes', async () => {
      const mockResponse = {
        data: [
          { id: 1, date: '2024-01-15', subject: 'Math' },
          { id: 2, date: '2024-01-16', subject: 'Science' },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await timetableApi.getScheduledClasses({
        curriculumId: 1,
        termId: 2,
        sectionId: 'A',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/timetable/scheduled-classes', {
        params: { curriculumId: 1, termId: 2, sectionId: 'A' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getCourses', () => {
    it('should post to comman_function/courses with semester in payload', async () => {
      const request = {
        academic_batch_id: 12,
        semester: 3,
        course_type_id: 7,
      };
      const mockResponse = {
        data: [
          { crs_id: 101, crs_title: 'Physics' },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await timetableApi.getCourses(request);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/comman_function/courses', request);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          value: '101',
          label: 'Physics',
          raw: { crs_id: 101, crs_title: 'Physics' },
        },
      ]);
    });
  });

  describe('updateScheduledClass', () => {
    const classId = 456;
    const updateData = { subject: 'Updated Math', time: '10:00-11:00' };

    it('should successfully update scheduled class', async () => {
      const mockResponse = { 
        data: { success: true, ...updateData },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.put.mockResolvedValue(mockResponse);

      const result = await timetableApi.updateScheduledClass(classId, updateData);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        `/api/v1/timetable/scheduled-classes/${classId}`,
        updateData
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Class updated successfully');
    });
  });

  describe('deleteScheduledClass', () => {
    const classId = 456;

    it('should successfully delete scheduled class', async () => {
      const mockResponse = { 
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await timetableApi.deleteScheduledClass(classId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(`/api/v1/timetable/scheduled-classes/${classId}`);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Class deleted successfully');
    });
  });

  describe('syncDateRange', () => {
    const semTimeTableId = 123;
    const syncData = { startDate: '2024-01-01', endDate: '2024-12-31' };

    it('should successfully sync date range', async () => {
      const mockResponse = { 
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.patch.mockResolvedValue(mockResponse);

      const result = await timetableApi.syncDateRange(semTimeTableId, syncData);

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `/api/v1/timetable/${semTimeTableId}/sync-range`,
        syncData
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Date range synced successfully');
    });
  });

  describe('exportTimetablePdf', () => {
    it('should successfully export timetable PDF', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const mockResponse = { 
        data: mockBlob,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      // Mock URL.createObjectURL and link click
      const mockCreateObjectURL = jest.fn().mockReturnValue('blob:url');
      const mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement and appendChild
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      const mockCreateElement = jest.fn().mockReturnValue(mockLink);
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();
      Object.defineProperty(document, 'createElement', { value: mockCreateElement });
      Object.defineProperty(document.body, 'appendChild', { value: mockAppendChild });
      Object.defineProperty(document.body, 'removeChild', { value: mockRemoveChild });

      const result = await timetableApi.exportTimetablePdf({
        semTimeTableId: 123,
        curriculumId: 456,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/timetable/export-pdf', {
        params: { semTimeTableId: 123, curriculumId: 456 },
        responseType: 'blob',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Timetable exported successfully');
    });
  });
});
