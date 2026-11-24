import "client-only";
import { api } from "./client";

export type Address = {
  id: string;
  label: string | null;
  line1: string | null;
  area: string | null;
  city: string;
  phone: string;
  isDefault: boolean;
  // Delivery area from the courier's lists (needed for courier delivery); names filled in by the server
  courierCityId?: number | null;
  courierCityName?: string | null;
  courierZoneId?: number | null;
  courierZoneName?: string | null;
  courierAreaId?: number | null;
  courierAreaName?: string | null;
};

export type AddressInput = {
  label?: string | null;
  line1: string;
  area?: string | null;
  city: string;
  phone: string;
  isDefault?: boolean;
  // all three or none (400 BAD_LOCATION otherwise)
  courierCityId?: number | null;
  courierZoneId?: number | null;
  courierAreaId?: number | null;
};

export const addressKeys = { all: ["addresses"] as const };

const base = "/users/me/addresses";

export function listAddresses(): Promise<Address[]> {
  return api.get<Address[]>(base);
}
export function createAddress(input: AddressInput): Promise<Address> {
  return api.post<Address>(base, input);
}
export function updateAddress(id: string, patch: Partial<AddressInput>): Promise<Address> {
  return api.patch<Address>(`${base}/${encodeURIComponent(id)}`, patch);
}
export function deleteAddress(id: string): Promise<unknown> {
  return api.delete<unknown>(`${base}/${encodeURIComponent(id)}`);
}