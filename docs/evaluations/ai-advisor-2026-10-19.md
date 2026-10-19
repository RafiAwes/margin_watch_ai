# AI Risk Advisor Evaluation — 2026-10-19

**Model:** `gemini-3.5-flash-lite` · **Scenarios:** 15 · **Valid replies:** 13/15 (schema + grounding check, plan D3)

Automatic checks are filled in. Score the last four columns 1–5 by hand (docs/ai-risk-advisor.md §6): **NF** numerical faithfulness, **SA** status alignment, **AC** actionability, **DG** data-gap identification.

| # | Profile | Status | Valid | Status named | Time | NF | SA | AC | DG |
|:-:|:--|:--|:-:|:-:|--:|:-:|:-:|:-:|:-:|
| 1 | Early project, low spend, low hours | `healthy` | ✅ | ✅ | 9.0s |  |  |  |  |
| 2 | Mid-project, 50% budget consumed, on track | `healthy` | ❌ | — | 10.3s |  |  |  |  |
| 3 | 82% budget consumed, forecast within budget | `at_risk` | ✅ | ✅ | 5.1s |  |  |  |  |
| 4 | 50% budget consumed, but huge remaining hours | `at_risk` | ✅ | ✅ | 4.3s |  |  |  |  |
| 5 | Actual spend at 105% of budget | `over_budget` | ✅ | ✅ | 4.7s |  |  |  |  |
| 6 | Actual spend at 140% of budget | `over_budget` | ✅ | ✅ | 9.1s |  |  |  |  |
| 7 | Missing estimated remaining hours | `insufficient_data` | ✅ | ✅ | 9.8s |  |  |  |  |
| 8 | Budget is $0.00 / missing | `insufficient_data` | ✅ | ✅ | 1.7s |  |  |  |  |
| 9 | Large pending expenses ($4,000 pending on a $10k budget) | `healthy` | ✅ | ✅ | 2.2s |  |  |  |  |
| 10 | High subcontractor expenses vs internal labor | `at_risk` | ❌ | — | 9.7s |  |  |  |  |
| 11 | Zero-revenue internal project | `healthy` | ✅ | ✅ | 2.2s |  |  |  |  |
| 12 | Overrun driven by a recent rate snapshot increase | `at_risk` | ✅ | ✅ | 9.4s |  |  |  |  |
| 13 | Project 95% complete with a $100 budget buffer | `at_risk` | ✅ | ✅ | 2.4s |  |  |  |  |
| 14 | Negative projected profit margin (projected cost > revenue) | `at_risk` | ✅ | ✅ | 7.0s |  |  |  |  |
| 15 | Large discrepancy between recorded hours and deliverables | `at_risk` | ✅ | ✅ | 7.0s |  |  |  |  |

## 1. Early project, low spend, low hours (`healthy`)

*Expected focus:* Confirm safe trajectory; recommend a regular estimate cadence.

**Summary:** Project PRJ-E8D8A326 is currently classified with a deterministic status of healthy. Actual total cost is $2,000.00 against a planned budget of $30,000.00, yielding a projected profit of $23,000.00 and a 46.00% profit margin. The project shows strong financial positioning with budget consumption at 6.67%.

**Drivers:**
- Total hours logged stand at 20.00 while estimated remaining hours are 250.00, indicating significant workload ahead.
- Actual labor cost is currently $2,000.00 against an estimated remaining labor cost of $25,000.00.

**Recommendations:**
1. Monitor velocity closely as the 250.00 estimated remaining hours are executed to prevent creep beyond the projected final cost of $27,000.00.
2. Maintain the current planned hourly cost rate of $100.0000 across resource assignments to protect the projected profit margin of 46.00%.
3. Track upcoming expenses against the expected remaining expenses baseline of $0.00 to preserve budget variances.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as per the MVP default.

## 2. Mid-project, 50% budget consumed, on track (`healthy`)

*Expected focus:* Note positive margin; warn against scope expansion without change orders.

**Rejected / failed:** ai_timeout: AI advisory timed out. Deterministic financials remain valid.

## 3. 82% budget consumed, forecast within budget (`at_risk`)

*Expected focus:* Explain the 80% consumption heuristic; highlight the narrow buffer.

**Summary:** Project PRJ-6218B3EE is currently classified with a deterministic status of at_risk. Budget consumption has reached 82.00% of the planned cost budget with 40.00 hours of work remaining. Active monitoring is required to protect the projected profit margin of 42.80%.

**Drivers:**
- Budget consumption (82.00%) has reached the 80.00% warning threshold.
- There are 40.00 estimated remaining hours of work, representing an estimated remaining labor cost of $4000.00 against a planned cost budget of $30000.00.

**Recommendations:**
1. Verify that the 40.00 estimated remaining hours strictly align with remaining deliverables to prevent budget overruns.
2. Monitor resource hourly cost rates to ensure they do not exceed the planned hourly cost rate of $100.0000.
3. Conduct a scope review with the client to freeze any new feature additions before utilizing the remaining budget.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as per the MVP default.

## 4. 50% budget consumed, but huge remaining hours (`at_risk`)

*Expected focus:* Highlight the forecast overrun driver; recommend scope triage or rate re-mix.

**Summary:** Project PRJ-942B7A8A is currently categorized with a deterministic status of at_risk. The projected final cost of $40,000.00 exceeds the planned cost budget of $30,000.00 by $10,000.00. Consequently, the projected profit margin has compressed to 20.00%.

**Drivers:**
- Projected final cost ($40,000.00) exceeds planned budget ($30,000.00) by $10,000.00.
- Actual labor cost of $15,000.00 has already consumed 50.00% of the total planned cost budget after only 150.00 logged hours.
- Estimated remaining labor cost is $25,000.00 for 250.00 estimated remaining hours.

**Recommendations:**
1. Negotiate scope reduction with the client to eliminate 100.00 hours of remaining work to bring the projected final cost back down to the $30,000.00 budget.
2. Adjust the resource mix by assigning lower-cost engineering resources to complete the 250.00 estimated remaining hours, reducing the blended hourly cost rate.
3. Recalibrate delivery estimates for the remaining 250.00 hours to verify if the burn rate can be accelerated without sacrificing quality.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 (MVP default).

## 5. Actual spend at 105% of budget (`over_budget`)

*Expected focus:* Immediate overrun alert; stop-work triage or client change order.

**Summary:** The project is currently classified with a deterministic status of over_budget. Actual labor costs of $31,500.00 have already exceeded the planned cost budget of $30,000.00 before completion. Projected final costs of $33,500.00 will reduce the projected profit to $16,500.00.

**Drivers:**
- Actual total cost ($31,500.00) exceeds planned budget ($30,000.00) by $1,500.00.
- Budget consumption percentage has reached 105.00% with 20.00 estimated remaining hours still to be worked.

**Recommendations:**
1. Negotiate a scope reduction or billable change order to account for the 20.00 estimated remaining hours and prevent further margin erosion.
2. Adjust the resource mix by transitioning remaining tasks to lower-cost resources if possible, keeping in mind the planned hourly cost rate of $100.0000.
3. Recalibrate future estimates using the actual labor cost rate of $100.0000 per hour to improve pricing accuracy on upcoming project phases or change requests.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as an MVP default.

## 6. Actual spend at 140% of budget (`over_budget`)

*Expected focus:* Severe overrun; senior leadership intervention and scope audit.

**Summary:** Project PRJ-E4987D01 is currently flagged with the deterministic status of over_budget. Actual total cost stands at $42,000.00 against a planned cost budget of $30,000.00, resulting in a budget consumption of 140.00%. Despite this variance, the projected profit is $5,000.00 with a projected profit margin percentage of 10.00%.

**Drivers:**
- Actual labor cost of $42,000.00 has already exceeded the total planned cost budget of $30,000.00 by $12,000.00.
- Budget consumption has reached 140.00% after logging 420.00 hours of work.
- Projected final cost has escalated to $45,000.00, driven by actual costs and 30.00 estimated remaining hours.

**Recommendations:**
1. Negotiate an immediate scope reduction or formal change order with the client to account for the $15,000.00 projected cost variance.
2. Restrict further resource allocation to strictly enforce the remaining 30.00 hours and prevent the estimated remaining labor cost of $3,000.00 from expanding.
3. Conduct a post-mortem review of the planned hourly cost rate of $100.0000 versus actual delivery rates to calibrate future project estimation models.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as an MVP default.

## 7. Missing estimated remaining hours (`insufficient_data`)

*Expected focus:* Forecasting is blind until the team estimates remaining scope.

**Summary:** The project is currently classified with a deterministic status of insufficient_data under Rule 2. Actual spending has not breached the budget ceiling of $30000.00, but the estimated remaining hours is unknown, preventing a reliable completion forecast.

**Drivers:**
- Estimated remaining hours is currently null, meaning no reliable completion forecast can be established.
- Actual labor cost is $12000.00 across 120.00 total hours logged against a planned cost budget of $30000.00.

**Recommendations:**
1. Require engineering leads to provide an updated estimate of remaining hours immediately to clear the data gap.
2. Audit current task velocity against the 120.00 hours logged to calibrate future estimates.
3. Establish strict weekly tracking for labor expenditure to ensure the $30000.00 planned cost budget is not breached.

**Data gaps & assumptions:**
- Estimated remaining hours is unknown (null).
- Estimated remaining labor cost is unknown (null).
- Projected final cost, cost variance, profit, and profit margin percentage are unknown due to missing remaining hours.

## 8. Budget is $0.00 / missing (`insufficient_data`)

*Expected focus:* No delivery-cost baseline exists to evaluate health against.

**Summary:** Project PRJ-CF1E223F is currently classified with the deterministic status of insufficient_data. This occurs because the planned cost budget is missing or zero, preventing a complete budget health evaluation. However, current financial metrics show a projected final cost of $9000.00 against a contract revenue of $50000.00.

**Drivers:**
- Planned cost budget is missing or zero, making budget consumption percentage null.
- Actual labor cost has reached $5000.00 across 50.00 total hours logged.
- Estimated remaining labor cost is $4000.00 based on 40.00 estimated remaining hours.

**Recommendations:**
1. Establish and input a formal planned cost budget immediately to enable accurate budget consumption tracking.
2. Monitor resource burn closely to ensure actual labor costs remain aligned with the planned hourly cost rate of $100.0000.

**Data gaps & assumptions:**
- Planned cost budget is missing or zero.
- Budget consumption percentage is null.
- Expected remaining expenses are assumed to be $0.00 as an MVP default.

## 9. Large pending expenses ($4,000 pending on a $10k budget) (`healthy`)

*Expected focus:* Caution that approving pending expenses would push the project to at risk.

**Summary:** Project PRJ-13242668 is currently rated as healthy. The actual total cost of $5,000.00 is well within the planned budget of $10,000.00, and the projected final cost is $8,000.00. However, attention must be paid to pending liabilities.

**Drivers:**
- Pending expenses total $4,000.00 across 1 pending expense item, which is not yet factored into the projected final cost.
- Actual labor cost has reached $5,000.00 for 50.00 hours logged, with an estimated remaining 30.00 hours costing $3,000.00.

**Recommendations:**
1. Review and approve or reject the pending expenses totaling $4,000.00 to incorporate exact figures into the final cost tracking.
2. Monitor team velocity closely to ensure the estimated remaining hours of 30.00 are not exceeded, protecting the projected profit of $7,000.00.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as an MVP default, excluding pending expenses.
- There is 1 pending expense totaling $4,000.00 awaiting final approval.

## 10. High subcontractor expenses vs internal labor (`at_risk`)

*Expected focus:* Identify subcontractor spend as the primary driver; suggest internal staffing.

**Rejected / failed:** ai_unavailable: AI advisor is temporarily unavailable. Deterministic financials remain valid.

## 11. Zero-revenue internal project (`healthy`)

*Expected focus:* Acknowledge the non-commercial nature; focus purely on the cost ceiling.

**Summary:** The project is currently classified with a deterministic status of healthy. The actual total cost of $5,000.00 and the projected final cost of $10,000.00 are both well within the planned cost budget of $20,000.00. Current budget consumption stands at 25.00% after 50.00 hours logged.

**Drivers:**
- Actual total cost is $5,000.00 against a planned cost budget of $20,000.00.
- Projected final cost is $10,000.00 with 50.00 hours logged and 50.00 estimated remaining hours.

**Recommendations:**
1. Monitor remaining hours closely to ensure the estimated remaining labor cost of $5,000.00 does not exceed projections.
2. Maintain the current resource mix to preserve the planned hourly cost rate of $100.0000.
3. Review scope periodically to keep the projected final cost within the $10,000.00 variance limit.

**Data gaps & assumptions:**
- Contract revenue is currently $0.00, indicating potential unbilled work or missing contract valuation.
- Expected remaining expenses are assumed to be $0.00 as an MVP default.
- Projected profit margin percentage is null and requires billing data for precise calculation.

## 12. Overrun driven by a recent rate snapshot increase (`at_risk`)

*Expected focus:* Note the higher blended burn rate (per-person rates are not shared with the AI).

**Summary:** The project is currently classified with a deterministic status of at_risk. The projected final cost of $31,400.00 exceeds the planned cost budget of $30,000.00 by $1,400.00. Immediate intervention is required to manage labor burn and protect the projected profit margin of 37.20% ($18,600.00).

**Drivers:**
- Projected final cost ($31,400.00) exceeds planned budget ($30,000.00) by $1,400.00.
- Actual labor cost has reached $17,000.00 across 160.00 logged hours, while an additional 180.00 hours remain estimated.

**Recommendations:**
1. Adjust the resource mix by shifting remaining tasks to lower-cost resources to offset the planned hourly cost rate of $80.0000.
2. Negotiate scope reduction with the client to trim the estimated remaining hours down from 180.00 to bring the projected final cost back below the $30,000.00 budget.
3. Recalibrate estimate models using the current burn rate of 160.00 hours logged against completed milestones.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as per the MVP default.

## 13. Project 95% complete with a $100 budget buffer (`at_risk`)

*Expected focus:* Recommend freezing non-essential polish to avoid crossing into over budget.

**Summary:** Project PRJ-F1CC1D4B is currently classified with a deterministic status of at_risk. Budget consumption has reached 99.67% of the planned cost budget, leaving only 1.00 estimated remaining hours. Immediate delivery oversight is required to prevent cost overruns.

**Drivers:**
- Budget consumption is at 99.67%, exceeding the 80.00% warning threshold.
- Actual labor cost has reached $29900.00 against a planned cost budget of $30000.00.
- Only 1.00 hours of estimated remaining work is left to complete the project.

**Recommendations:**
1. Freeze any additional scope additions immediately and enforce strict change order management for any new requests.
2. Review the final 1.00 hour of remaining work closely to ensure completion within the $100.00 estimated remaining labor cost.
3. Verify that no unapproved or pending expenses remain to be billed to the project.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as per MVP defaults.

## 14. Negative projected profit margin (projected cost > revenue) (`at_risk`)

*Expected focus:* Warn of delivery at an operating loss; prioritize commercial renegotiation.

**Summary:** Project PRJ-F5AAFEC1 is currently designated as at_risk due to negative projected profitability. The projected final cost of $28,000.00 exceeds the planned cost budget of $26,000.00 by $2,000.00, resulting in a projected profit of -$3,000.00 and a projected profit margin percentage of -12.00%.

**Drivers:**
- Projected final cost of $28,000.00 exceeds the planned cost budget of $26,000.00 by $2,000.00.
- Actual labor cost has already reached $20,000.00 across 200.00 total hours logged.
- Estimated remaining labor cost is $8,000.00 based on 80.00 estimated remaining hours.

**Recommendations:**
1. Negotiate a scope reduction immediately to eliminate the 80.00 estimated remaining hours and bring the projected final cost back under the $26,000.00 budget.
2. Re-evaluate the resource mix to assign less costly personnel to the remaining 80.00 hours, lowering the planned hourly cost rate from the current $100.00 average.
3. Engage the client for a change order to cover the $2,000.00 cost variance and restore positive project margins.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as an MVP default.

## 15. Large discrepancy between recorded hours and deliverables (`at_risk`)

*Expected focus:* Advise auditing timesheet descriptions for out-of-scope work.

**Summary:** Project PRJ-78CB9FD6 is currently categorized with an at_risk deterministic status. The projected final cost of $33,000.00 exceeds the planned cost budget of $30,000.00 by $3,000.00. Immediate intervention is required to recover the projected profit margin.

**Drivers:**
- Projected final cost ($33,000.00) exceeds planned budget ($30,000.00) by $3,000.00.
- Actual labor cost has reached $18,000.00 for 180.00 hours logged.
- Estimated remaining labor cost stands at $15,000.00 across 150.00 estimated remaining hours.

**Recommendations:**
1. Negotiate a formal scope reduction or a change order to offset the $3,000.00 projected cost variance and restore original profit margins.
2. Review the resource mix to determine if lower-cost labor rates can be utilized for the remaining 150.00 hours to reduce the estimated remaining labor cost of $15,000.00.
3. Re-calibrate the estimate to complete to ensure the 150.00 estimated remaining hours do not expand further against the $30,000.00 planned cost budget.

**Data gaps & assumptions:**
- Expected remaining expenses are assumed to be $0.00 as per MVP default assumptions.
