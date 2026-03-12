import { ApplicationError } from "../../application/errors/application-error";
import type { WhatsAppProvider, WhatsAppProviderRegistry } from "../../application/ports/whatsapp-provider";

export class DefaultWhatsAppProviderRegistry implements WhatsAppProviderRegistry {
  private readonly providersByName: Map<WhatsAppProvider["providerName"], WhatsAppProvider>;

  constructor(providers: WhatsAppProvider[]) {
    this.providersByName = new Map(providers.map((provider) => [provider.providerName, provider]));
  }

  get(providerName: WhatsAppProvider["providerName"]): WhatsAppProvider {
    const provider = this.providersByName.get(providerName);

    if (!provider) {
      throw new ApplicationError(`Provider ${providerName} is not configured`, {
        code: "provider_not_configured",
        statusCode: 500
      });
    }

    return provider;
  }
}
