import Configuration from "../../api/service/core/Configuration.ts";
import ConfigurationService from "./ConfigurationService.ts";

export default class DefaultConfiguration implements Configuration {
  private readonly configurationService: ConfigurationService;

  constructor(configurationService: ConfigurationService) {
    this.configurationService = configurationService;
  }

  getConfigLocation(): string {
    return this.configurationService.configLocation;
  }
}
