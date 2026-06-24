-- Add CUSTOM meeting type for merchant-defined options
ALTER TYPE "MeetingTypeKind" ADD VALUE IF NOT EXISTS 'CUSTOM';
