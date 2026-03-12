import { DatabaseDialect, ProjectStatus } from './enums';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  dialect: DatabaseDialect;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  dialect: DatabaseDialect;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  dialect?: DatabaseDialect;
  status?: ProjectStatus;
}

export interface ProjectStats {
  tableCount: number;
  queryCount: number;
  fileCount: number;
  migrationCount: number;
  lastActivity: string | null;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  dialect: string | null;
  checksum: string;
  uploadedAt: string;
}
