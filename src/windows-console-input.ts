/*
 * NOTE: this whole file is generated entirely by chatgpt. i ain't doing this much
 * for a system i don't even use. i'm not willing to deal with windows myself.
 * the comments given should be enough to understand this
 * */

import { closeSync, createReadStream, openSync } from "node:fs";
import { dlopen, FFIType } from "bun:ffi";

const { symbols: win32 } = dlopen("kernel32.dll", {
  CreateFileW: {
    args: [
      FFIType.ptr,
      FFIType.u32,
      FFIType.u32,
      FFIType.ptr,
      FFIType.u32,
      FFIType.u32,
      FFIType.u64,
    ],
    returns: FFIType.u64,
  },
  GetConsoleMode: {
    args: [FFIType.u64, FFIType.ptr],
    returns: FFIType.i32,
  },
  SetConsoleMode: {
    args: [FFIType.u64, FFIType.u32],
    returns: FFIType.i32,
  },
  CloseHandle: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
  GetLastError: {
    args: [],
    returns: FFIType.u32,
  },
});

const INVALID_HANDLE_VALUE = 0xffffffffffffffffn;

function isInvalidHandle(handle: unknown): boolean {
  return (
    handle === INVALID_HANDLE_VALUE
    || handle === -1n
    || handle === Number(INVALID_HANDLE_VALUE)
    || handle === -1
  );
}

export function openWindowsConsoleInput() {
  // CreateFileW requires a null-terminated UTF-16 string.
  const consoleName = new Uint16Array(
    [..."CONIN$", "\0"].map((char) => char.charCodeAt(0)),
  );

  const handle = win32.CreateFileW(
    consoleName,
    0xc0000000, // GENERIC_READ | GENERIC_WRITE
    0x00000003, // FILE_SHARE_READ | FILE_SHARE_WRITE
    0, // No security attributes
    3, // OPEN_EXISTING
    0,
    0n, // No template file
  );

  if (isInvalidHandle(handle)) {
    throw new Error(
      `CreateFileW(CONIN$) failed: Win32 error ${win32.GetLastError()}`,
    );
  }

  const originalMode = new Uint32Array(1);

  if (!win32.GetConsoleMode(handle, originalMode)) {
    const error = win32.GetLastError();
    win32.CloseHandle(handle);
    throw new Error(`GetConsoleMode(CONIN$) failed: Win32 error ${error}`);
  }

  // Equivalent to libuv's raw-VT console input mode.
  const rawVtMode = 0x0008 | 0x0200; // ENABLE_WINDOW_INPUT | ENABLE_VIRTUAL_TERMINAL_INPUT

  if (!win32.SetConsoleMode(handle, rawVtMode)) {
    const error = win32.GetLastError();
    win32.CloseHandle(handle);

    throw new Error(
      `SetConsoleMode(CONIN$) failed: Win32 error ${error}. `
        + "The console may not support virtual-terminal input.",
    );
  }

  let restored = false;

  const restore = () => {
    if (restored) return;
    restored = true;
    win32.SetConsoleMode(handle, originalMode[0]!);
    win32.CloseHandle(handle);
  };
  let fd: number | undefined; // fd = file descriptor
  try {
    // This is an ordinary fs stream, NOT tty.ReadStream.
    fd = openSync("CONIN$", "r+");
    const stream = createReadStream("CONIN$", {
      fd,
      autoClose: true,
    });
    // Tell OpenTUI that this custom input stream represents a TTY.
    Object.assign(stream, { isTTY: true });
    // Restore the console even if the application exits unexpectedly.
    process.once("exit", restore);
    return {
      stream: stream as unknown as NodeJS.ReadStream,
      restore,
    };
  } catch (error) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // The descriptor may already have been closed.
      }
    }
    restore();
    throw error;
  }
}
