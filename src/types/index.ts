import { UserRole, LicenseType } from "@prisma/client";

export type { UserRole, LicenseType };

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  companyId?: string | null;
}

export interface BookWithChapters {
  id: string;
  title: string;
  author: string;
  narrator?: string | null;
  duration: number;
  coverUrl?: string | null;
  description?: string | null;
  category?: { name: string; slug: string } | null;
  chapters: {
    id: string;
    title: string;
    order: number;
    duration: number;
    s3Key: string;
  }[];
}

export interface CompanyWithStats {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  licenseType: LicenseType;
  maxSeats: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  _count: { users: number };
  package?: { name: string } | null;
}

export interface DashboardStats {
  totalListenedHours: number;
  activeUsers: number;
  totalUsers: number;
  topBooks: { bookId: string; title: string; totalSec: number }[];
}
