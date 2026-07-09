import { Role } from "../enums/Role";

export interface UserProps {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
}

/** A named identity in the User App. Credentials are stored hashed + salted, never in plaintext. */
export class User {
  constructor(private readonly props: UserProps) {}

  get id(): string { return this.props.id; }
  get username(): string { return this.props.username; }
  get displayName(): string { return this.props.displayName; }
  get role(): Role { return this.props.role; }
  get passwordHash(): string { return this.props.passwordHash; }
  get passwordSalt(): string { return this.props.passwordSalt; }

  /** Safe projection for API responses — never exposes the credential material. */
  toPublic(): { id: string; username: string; displayName: string; role: Role } {
    return { id: this.props.id, username: this.props.username, displayName: this.props.displayName, role: this.props.role };
  }
}
