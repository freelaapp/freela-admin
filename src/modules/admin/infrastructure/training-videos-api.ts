import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const trainingVideosApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/admin`,
  headers: {
    "Content-Type": "application/json",
  },
});

trainingVideosApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("authUser");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user.accessToken) {
          config.headers.Authorization = `Bearer ${user.accessToken}`;
        }
      } catch {
        // ignore
      }
    }
  }
  return config;
});

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type TrainingVideoAudience = "FREELANCER" | "CONTRACTOR" | "BOTH";
export type TrainingVideoProvider = "YOUTUBE" | "VIMEO";

export interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  category: string;
  targetAudience: TrainingVideoAudience;
  externalVideoUrl: string;
  externalProvider: TrainingVideoProvider | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingVideoInput {
  title: string;
  description?: string;
  category: string;
  targetAudience: TrainingVideoAudience;
  externalVideoUrl: string;
  externalProvider?: TrainingVideoProvider;
  displayOrder?: number;
  active?: boolean;
}

export type UpdateTrainingVideoInput = Partial<CreateTrainingVideoInput>;

// ─── Funções ────────────────────────────────────────────────────────────────

export async function getTrainingVideos(): Promise<TrainingVideo[]> {
  const res = await trainingVideosApi.get("/training-videos");
  return res.data.data;
}

export async function createTrainingVideo(
  dto: CreateTrainingVideoInput,
): Promise<TrainingVideo> {
  const res = await trainingVideosApi.post("/training-videos", dto);
  return res.data.data;
}

export async function updateTrainingVideo(
  id: string,
  dto: UpdateTrainingVideoInput,
): Promise<TrainingVideo> {
  const res = await trainingVideosApi.patch(`/training-videos/${id}`, dto);
  return res.data.data;
}

export async function deleteTrainingVideo(id: string): Promise<TrainingVideo> {
  const res = await trainingVideosApi.delete(`/training-videos/${id}`);
  return res.data.data;
}
