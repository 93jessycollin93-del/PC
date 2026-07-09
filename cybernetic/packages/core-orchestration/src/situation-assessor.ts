/**
 * Situation Assessor — Monitor system resources
 * Thermal (GPU), memory usage, battery drain
 * Decides which model tier can be deployed (lightweight vs full)
 */

export interface SystemState {
  gpuTempC: number;
  cpuTempC: number;
  memoryUsagePercent: number;
  memoryAvailableMb: number;
  batteryPercent: number;
  batteryDrain: number; // mW/min
}

export interface CapacityAssessment {
  canDeployFullModels: boolean;
  shouldDeployLightweightOnly: boolean;
  thermalStatus: "safe" | "warning" | "critical";
  memoryStatus: "abundant" | "adequate" | "constrained";
  batteryStatus: "healthy" | "moderate" | "low";
  recommendations: string[];
}

export class SitationAssessor {
  private thermalThresholds = {
    safe: 60,
    warning: 70,
    critical: 75,
  };

  private memoryThresholds = {
    abundant: 1500, // MB available
    adequate: 800,
    constrained: 200,
  };

  private batteryThresholds = {
    healthy: 30, // % remaining
    moderate: 15,
    low: 5,
  };

  /**
   * Assess current system capacity
   */
  assessCapacity(state: SystemState): CapacityAssessment {
    const thermalStatus = this.getThermalStatus(state.gpuTempC);
    const memoryStatus = this.getMemoryStatus(state.memoryAvailableMb);
    const batteryStatus = this.getBatteryStatus(state.batteryPercent);

    const canDeployFullModels =
      thermalStatus === "safe" &&
      memoryStatus === "abundant" &&
      batteryStatus !== "low";

    const shouldDeployLightweightOnly =
      thermalStatus === "warning" ||
      memoryStatus === "constrained" ||
      batteryStatus === "moderate";

    const recommendations: string[] = [];

    if (thermalStatus === "critical") {
      recommendations.push("GPU temperature critical - pause model loading");
    }
    if (thermalStatus === "warning") {
      recommendations.push("GPU temperature elevated - deploy lightweight models only");
    }
    if (memoryStatus === "constrained") {
      recommendations.push("Memory constrained - limit concurrent agents");
    }
    if (batteryStatus === "low") {
      recommendations.push("Battery low - minimize inference, prioritize lightweight tasks");
    }

    return {
      canDeployFullModels,
      shouldDeployLightweightOnly,
      thermalStatus,
      memoryStatus,
      batteryStatus,
      recommendations,
    };
  }

  private getThermalStatus(gpuTempC: number): "safe" | "warning" | "critical" {
    if (gpuTempC >= this.thermalThresholds.critical) return "critical";
    if (gpuTempC >= this.thermalThresholds.warning) return "warning";
    return "safe";
  }

  private getMemoryStatus(availableMb: number): "abundant" | "adequate" | "constrained" {
    if (availableMb >= this.memoryThresholds.abundant) return "abundant";
    if (availableMb >= this.memoryThresholds.adequate) return "adequate";
    return "constrained";
  }

  private getBatteryStatus(batteryPercent: number): "healthy" | "moderate" | "low" {
    if (batteryPercent >= this.batteryThresholds.healthy) return "healthy";
    if (batteryPercent >= this.batteryThresholds.moderate) return "moderate";
    return "low";
  }
}
