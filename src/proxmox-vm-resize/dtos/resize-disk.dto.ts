/**
 * DTOs for HTTP API (controller) and service layer.
 *
 * @module proxmox-vm-resize/dtos/resize-disk.dto
 */

/** Request body for `POST /vms/:id/resize-disk`. */
export interface ResizeVmDiskHttpRequestDto {
  readonly disk: string;
  readonly size: string;
}

/** Successful HTTP response body returned to API clients. */
export interface ResizeVmDiskHttpResponseDto {
  readonly ok: true;
  readonly vmId: number;
  readonly node: string;
  readonly disk: string;
  readonly size: string;
  readonly methodUsed: "PUT" | "POST";
  readonly taskUpid: string | null;
  readonly message: string;
}
