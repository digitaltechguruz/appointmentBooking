import type {
  Booking,
  Customer,
  MeetingType,
  Service,
} from "@prisma/client";

export type BookingWithRelations = Booking & {
  service: Service;
  meetingType: MeetingType;
  customer: Customer;
};

export type ServiceWithMeetingTypes = Service & {
  meetingTypes: Array<{
    meetingTypeId: string;
    meetingType: MeetingType;
  }>;
};
