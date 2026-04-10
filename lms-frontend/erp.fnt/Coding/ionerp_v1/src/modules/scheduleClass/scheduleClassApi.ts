import { scheduledClasses as mockScheduledClasses } from "./mockData";

// Using localStorage as mock storage since backend is not available
const STORAGE_KEY = "scheduled_classes";

export const scheduleClassApi = {
  saveSchedule: async (data: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Get existing classes from localStorage
      const existingData = localStorage.getItem(STORAGE_KEY);
      const scheduledClasses = existingData ? JSON.parse(existingData) : [...mockScheduledClasses];

      // Create new class object
      const newClass = {
        id: Date.now(),
        ...data,
        createdAt: new Date().toISOString()
      };

      // Add new class to list
      scheduledClasses.push(newClass);

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduledClasses));

      return { data: newClass, message: "Class scheduled successfully!" };
    } catch (error) {
      throw new Error("Failed to save class to storage");
    }
  },

  // Get all scheduled classes
  getAll: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const existingData = localStorage.getItem(STORAGE_KEY);
    const scheduledClasses = existingData ? JSON.parse(existingData) : [...mockScheduledClasses];
    return { data: scheduledClasses };
  },

  // Delete a scheduled class
  delete: async (id: number) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const existingData = localStorage.getItem(STORAGE_KEY);
      let scheduledClasses = existingData ? JSON.parse(existingData) : [...mockScheduledClasses];

      scheduledClasses = scheduledClasses.filter((cls: any) => cls.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduledClasses));

      return { data: { success: true } };
    } catch (error) {
      throw new Error("Failed to delete class");
    }
  }
};
