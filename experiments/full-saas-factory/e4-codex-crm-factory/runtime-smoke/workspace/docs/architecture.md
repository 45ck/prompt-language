# CRM Architecture

The CRM follows inward-only layering: presentation -> infrastructure -> application -> domain.

- Domain: customer, account, contact, and opportunity rules with zero external dependencies.
- Application: use cases that coordinate workflows, permissions, and transactions.
- Infrastructure: persistence, messaging, and third-party adapters behind application interfaces.
- Presentation: API or UI entry points that validate input, map DTOs, and call application services.
