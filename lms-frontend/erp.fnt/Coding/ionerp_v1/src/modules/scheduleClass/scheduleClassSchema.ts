import * as yup from "yup";

export const scheduleClassSchema = yup.object({
  courseTypeId: yup.string().required("Course Type is required"),
  courseId: yup.string().required("Course is required"),
  courseCode: yup.string().optional(),
  sectionId: yup.string().required("Section is required"),
  topicId: yup.string().required("Topic is required"),
  topicDescription: yup.string().optional(),
  classDate: yup.string().required("Class Date is required"),
  duration: yup.number().optional().positive().min(0.5),
  startTime: yup.string().required("Start Time is required"),
  endTime: yup
    .string()
    .required("End Time is required")
    .test("time-check", "End Time must be after Start Time", function (this: yup.TestContext, value: string | undefined) {
      if (!value || !this.parent?.startTime) return false;
      return value > (this.parent.startTime as string);
    }),
  location: yup.string().optional(),
  notes: yup.string().optional(),
});
