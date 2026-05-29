export interface ConsultantSession {
  email: string;
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

export type RegistrationPersona = "provider" | "contractor";
export type RegistrationModule = "bars-restaurants" | "home-services" | "freela-em-casa";

export interface CreateRegistrationPayload {
  persona: RegistrationPersona;
  module?: RegistrationModule;
  name: string;
  phone: string;
  email?: string;
  cityId?: string;
}

export interface RegistrationItem {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  persona: string | null;
  module: string | null;
  status: "pending" | "active";
  createdAt: string;
}
