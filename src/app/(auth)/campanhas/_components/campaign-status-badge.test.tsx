import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CAMPAIGN_STATUS_LABEL, CampaignStatusBadge } from "./campaign-status-badge";

describe("CampaignStatusBadge", () => {
  it("mostra a situação nova Agendada", () => {
    render(<CampaignStatusBadge status="SCHEDULED" />);
    expect(screen.getByText("Agendada")).toHaveClass("bg-violet-100", "text-violet-800");
    expect(CAMPAIGN_STATUS_LABEL.SCHEDULED).toBe("Agendada");
  });
});
