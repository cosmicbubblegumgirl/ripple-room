# Inside Ripple Room

288 documented tools, controls and analytic measures. These are individually addressable in the in-app inventory. This count includes analytic measures and settings; it is not a claim that each is a separate product module.

## Living laboratory

| Capability | Identifier |
|---|---|
| Who disappears? Explore lost access | `action:living-disappears` |
| Follow one person through the change | `action:living-follow` |
| Explore the decision multiverse | `action:living-multiverse` |
| Test one tiny change | `action:living-tiny` |
| Break this decision with explicit disruptions | `action:living-break` |
| Explore constraint constellations | `action:living-constellation` |
| Replay captured model runs | `action:living-replay` |

## Workspace

| Capability | Identifier |
|---|---|
| Create a room | `action:new` |
| Start an empty room | `action:new-empty` |
| Browse device rooms | `action:rooms` |
| Rename and describe a room | `action:metadata` |
| Duplicate the complete room | `action:duplicate-room` |
| Save device workspace now | `action:local-save` |
| Undo a workspace change | `action:undo` |
| Redo an undone change | `action:redo` |
| Reset proposed conditions | `action:reset-policy` |
| Edit current conditions | `action:baseline-editor` |
| Promote proposal to baseline | `action:baseline-from-policy` |
| Install home-screen shortcut | `action:install` |

## Data

| Capability | Identifier |
|---|---|
| Export full portable backup | `action:export-json` |
| Export anonymised backup | `action:export-anonymous` |
| Import room JSON or resident CSV | `action:import` |
| Download resident CSV template | `action:csv-template` |
| Export resident constraints | `action:people-export` |
| Export resident-day outcomes | `action:outcomes-export` |
| Export every analytic measure | `action:metrics-export` |
| Export group access comparison | `action:groups-export` |
| Export first-barrier counts | `action:bottleneck-export` |
| Export alternative results | `action:alternative-export` |
| Export closing-time sensitivity | `action:sensitivity-export` |
| Export scenario comparison | `action:comparison-export` |
| Export scenario archive | `action:comparison-json` |
| Export evidence and discussion | `action:evidence-export` |
| Export current and proposed settings | `action:policy-export` |
| Download calculation method | `action:methods-export` |
| Export your preferences | `action:preferences-export` |
| Export tool inventory | `action:capabilities-export` |

## Charts

| Capability | Identifier |
|---|---|
| Export availability chart as SVG | `action:chart-svg` |
| Export availability chart as PNG | `action:chart-png` |
| Export ripple relationship diagram | `action:ripple-svg` |
| Explore availability timeline | `action:chart-timeline` |
| Explore relationship ripples | `action:chart-map` |
| Explore group reach bars | `action:chart-groups` |
| Expand / collapse timeline observations | `action:toggle-rows` |

## Residents

| Capability | Identifier |
|---|---|
| Add anonymous resident constraints | `action:add-person` |
| Bulk-update matching constraints | `action:bulk-edit` |
| Switch resident cards / table | `action:person-layout` |
| Reset resident filters | `action:clear-filters` |
| Find residents losing access | `action:filter-lost` |
| Find residents gaining access | `action:filter-gained` |
| Find missing availability | `action:filter-unknown` |
| Prioritise affected profiles | `action:sort-impact` |

## Scenarios

| Capability | Identifier |
|---|---|
| Capture a named scenario | `action:snapshot` |
| Remove saved snapshots | `action:clear-scenarios` |
| Test explicit disruptions | `action:stress-test` |

## Evidence

| Capability | Identifier |
|---|---|
| Record a source or assumption | `action:add-evidence` |
| Record a discussion or next step | `action:add-note` |

## Reports

| Capability | Identifier |
|---|---|
| Print or save a PDF brief | `action:print` |
| Export a standalone HTML brief | `action:report-html` |
| Export a Markdown brief | `action:report-markdown` |
| Copy plain-language summary | `action:report-copy` |
| Create an aggregate snapshot link | `action:share` |
| Choose report sections | `action:report-settings` |
| Restore report defaults | `action:report-defaults` |

## Preferences

| Capability | Identifier |
|---|---|
| Customise appearance and accessibility | `action:settings` |
| Restore interface defaults | `action:reset-prefs` |

## Cloud

| Capability | Identifier |
|---|---|
| Cloud account and connection | `action:account` |
| Save explicit private cloud copy | `action:cloud-save` |
| Browse private cloud copies | `action:cloud-rooms` |
| Sign out on this device | `action:signout` |

## Help

| Capability | Identifier |
|---|---|
| Read the five-step field guide | `action:guide` |
| Inspect calculation method | `action:methods` |
| Read data and sharing practices | `action:privacy` |
| Read accessibility controls | `action:accessibility` |
| Browse tools and analytic measures | `action:capabilities` |

## Analytic measures

| Capability | Identifier |
|---|---|
| Resident profiles | `metric:profiles` |
| Resident-day observations | `metric:observations` |
| Complete observations | `metric:known` |
| Unknown outcomes | `metric:unknown` |
| Represented resident visits | `metric:population` |
| Proposed access | `metric:served` |
| Current access | `metric:baselineServed` |
| Proposed exclusions | `metric:excluded` |
| Access lost | `metric:lost` |
| Access gained | `metric:gained` |
| Proposed reach | `metric:reach` |
| Current reach | `metric:baseReach` |
| Net access change | `metric:net` |
| Available window minutes | `metric:windowMinutes` |
| Current window minutes | `metric:baselineWindowMinutes` |
| Allocated session minutes | `metric:scheduledMinutes` |
| Current allocated minutes | `metric:baselineScheduledMinutes` |
| Requested session minutes | `metric:requestedMinutes` |
| Unmet session minutes | `metric:unmetMinutes` |
| Mean available window | `metric:averageWindow` |
| Median available window | `metric:medianWindow` |
| Shortest available window | `metric:minWindow` |
| Longest available window | `metric:maxWindow` |
| Mean allocated session | `metric:averageSession` |
| Median allocated session | `metric:medianSession` |
| Mean round-trip travel | `metric:averageTravel` |
| Availability completeness | `metric:completeness` |
| Group reach gap | `metric:equityGap` |
| Lowest group reach | `metric:minGroupReach` |
| Highest group reach | `metric:maxGroupReach` |
| Proposed daily opening | `metric:openingHours` |
| Current daily opening | `metric:baselineOpeningHours` |
| Daily opening change | `metric:hoursChange` |
| Estimated proposed operating cost | `metric:operatingCost` |
| Estimated current operating cost | `metric:baselineCost` |
| Available seat-hours | `metric:seatHours` |
| Available computer-hours | `metric:computerHours` |
| Represented groups | `metric:activeGroups` |
| Days in this run | `metric:activeDays` |
| Transit-dependent observations | `metric:transitProfiles` |
| Computer-dependent observations | `metric:computerProfiles` |
| Step-free-dependent observations | `metric:accessProfiles` |
| Accompanying-child observations | `metric:careProfiles` |
| Internet-dependent observations | `metric:wifiProfiles` |
| Quiet-space observations | `metric:quietProfiles` |
| Priority observations | `metric:highPriority` |
| Residents represented | `metric:representedResidents` |
| Excluded profile visits | `metric:blockedProfiles` |
| Served profile visits | `metric:servedProfiles` |
| Lost profile visits | `metric:lostProfiles` |
| Gained profile visits | `metric:gainedProfiles` |
| Unchanged profile visits | `metric:unchangedProfiles` |
| Earliest effective arrival | `metric:earliestArrival` |
| Latest effective departure | `metric:latestDeparture` |
| Estimated operating cost change | `metric:costChange` |
| Estimated cost per served visit | `metric:costPerServed` |
| Allocated hours lost | `metric:hoursLost` |
| Modelled seat utilisation | `metric:seatUtilisation` |
| Modelled computer utilisation | `metric:computerUtilisation` |
| Reach change | `metric:reachChange` |
| Exclusion rate | `metric:exclusionRate` |
| Share of current access lost | `metric:lossRate` |
| Share gaining access | `metric:gainRate` |
| Share of session demand unmet | `metric:unmetRate` |
| Allocated session hours | `metric:scheduledHours` |
| Current allocated hours | `metric:baselineScheduledHours` |
| Available window hours | `metric:windowHours` |
| Current available hours | `metric:baselineWindowHours` |
| Requested session hours | `metric:requestedHours` |
| Unmet session hours | `metric:unmetHours` |
| Estimated operating savings | `metric:costSavings` |
| Travel-cost exposure if excluded visits still travel | `metric:travelExposure` |
| Trip-emission exposure if excluded visits still travel | `metric:carbonExposure` |
| Supplied staff-hours | `metric:totalStaffHours` |
| Computers per represented visit | `metric:computersPerResident` |
| Seats per represented visit | `metric:seatsPerResident` |
| Mean representation weight | `metric:averageWeight` |
| Median representation weight | `metric:medianWeight` |
| Missing arrival times | `metric:missingArrival` |
| Missing departure times | `metric:missingDeadline` |
| Missing session lengths | `metric:missingDuration` |
| Profiles with a source label | `metric:evidenceCoverage` |
| Transit-dependent reach | `metric:transitReach` |
| Transit-dependent exclusions | `metric:transitExcluded` |
| Transit-dependent access | `metric:transitServed` |
| Computer-dependent reach | `metric:computerReach` |
| Computer-dependent exclusions | `metric:computerExcluded` |
| Computer-dependent access | `metric:computerServed` |
| Step-free-dependent reach | `metric:accessReach` |
| Step-free-dependent exclusions | `metric:accessExcluded` |
| Step-free-dependent access | `metric:accessServed` |
| Accompanying-child reach | `metric:careReach` |
| Accompanying-child exclusions | `metric:careExcluded` |
| Accompanying-child access | `metric:careServed` |
| Internet-dependent reach | `metric:wifiReach` |
| Internet-dependent exclusions | `metric:wifiExcluded` |
| Internet-dependent access | `metric:wifiServed` |
| Quiet-space reach | `metric:quietReach` |
| Quiet-space exclusions | `metric:quietExcluded` |
| Quiet-space access | `metric:quietServed` |
| Estimated-availability outcomes | `metric:estimated` |
| Current supplied staff-hours | `metric:baselineStaffHours` |
| Current travel-cost exposure | `metric:baselineTravelExposure` |
| Current trip-emission exposure | `metric:baselineCarbonExposure` |

## Decision controls

| Capability | Identifier |
|---|---|
| Proposed: Opening time | `policy:open` |
| Proposed: Closing time | `policy:close` |
| Proposed: Available seats | `policy:seats` |
| Proposed: Computer places | `policy:computers` |
| Proposed: Minimum session | `policy:minSession` |
| Proposed: Travel safety buffer | `policy:buffer` |
| Proposed: Last bus departure | `policy:lastBus` |
| Proposed: Later bus allowance | `policy:extraBus` |
| Proposed: Arrival disruption | `policy:lateStart` |
| Proposed: Extra travel each way | `policy:travelAdjustment` |
| Proposed: Session adjustment | `policy:sessionAdjustment` |
| Proposed: Reserved seats | `policy:seatReserve` |
| Proposed: Allocation order | `policy:priority` |
| Proposed: Step-free access | `policy:wheelchair` |
| Proposed: Internet access | `policy:wifi` |
| Proposed: Power available | `policy:power` |
| Proposed: Quiet space | `policy:quiet` |
| Proposed: Staff coverage | `policy:staff` |
| Proposed: Accompanying children | `policy:children` |
| Proposed: Weekend access | `policy:weekend` |
| Proposed: Hourly operating cost | `policy:costPerHour` |
| Proposed: Return-trip cost | `policy:travelCost` |
| Proposed: Staff count | `policy:staffCount` |
| Proposed: Staff hours | `policy:staffHours` |
| Proposed: Trip emissions assumption | `policy:carbonPerTrip` |

## Baseline controls

| Capability | Identifier |
|---|---|
| Current: Opening time | `baseline:open` |
| Current: Closing time | `baseline:close` |
| Current: Available seats | `baseline:seats` |
| Current: Computer places | `baseline:computers` |
| Current: Minimum session | `baseline:minSession` |
| Current: Travel safety buffer | `baseline:buffer` |
| Current: Last bus departure | `baseline:lastBus` |
| Current: Later bus allowance | `baseline:extraBus` |
| Current: Arrival disruption | `baseline:lateStart` |
| Current: Extra travel each way | `baseline:travelAdjustment` |
| Current: Session adjustment | `baseline:sessionAdjustment` |
| Current: Reserved seats | `baseline:seatReserve` |
| Current: Allocation order | `baseline:priority` |
| Current: Step-free access | `baseline:wheelchair` |
| Current: Internet access | `baseline:wifi` |
| Current: Power available | `baseline:power` |
| Current: Quiet space | `baseline:quiet` |
| Current: Staff coverage | `baseline:staff` |
| Current: Accompanying children | `baseline:children` |
| Current: Weekend access | `baseline:weekend` |
| Current: Hourly operating cost | `baseline:costPerHour` |
| Current: Return-trip cost | `baseline:travelCost` |
| Current: Staff count | `baseline:staffCount` |
| Current: Staff hours | `baseline:staffHours` |
| Current: Trip emissions assumption | `baseline:carbonPerTrip` |

## Display and accessibility

| Capability | Identifier |
|---|---|
| Interface motion | `pref:motion` |
| Higher contrast | `pref:contrast` |
| Window labels | `pref:chartLabels` |
| Timeline grid | `pref:chartGrid` |
| Current-situation overlay | `pref:chartBaseline` |
| Alias initials on charts | `pref:chartAvatars` |
| Chart transitions | `pref:chartAnimation` |
| Show unknown outcomes | `pref:showUnknown` |
| Show retained access | `pref:showRetained` |
| Show existing exclusions | `pref:showExcluded` |
| Show gained access | `pref:showGained` |
| Show lost access | `pref:showLost` |
| Chart legends | `pref:showLegend` |
| Representation weights in profiles | `pref:showWeights` |
| Resident context in cards | `pref:showNotes` |
| Travel columns in resident tables | `pref:showTravel` |
| Required session on timeline | `pref:showMinSession` |
| Buffer reminder under charts | `pref:showBuffer` |
| Capacity reminder under charts | `pref:showCapacity` |
| Day labels | `pref:showDay` |
| Group labels | `pref:showGroup` |
| Source labels in tables | `pref:showSource` |
| Automatically save to this device | `pref:autoSave` |
| Keyboard shortcuts | `pref:keyboard` |
| Confirm removal actions | `pref:confirmDelete` |
| Expanded text summary under charts | `pref:screenReader` |
| Keep decision controls in view | `pref:stickyControls` |
| Alternating table rows | `pref:tableStriped` |
| Compact tables | `pref:tableCompact` |
| Reduce visual shadows | `pref:reduceShadows` |
| Larger button targets | `pref:largeTargets` |
| Focus on the workspace | `pref:focusMode` |
| Colour atmosphere | `pref:theme` |
| Accent palette | `pref:accent` |
| Reading scale | `pref:fontSize` |
| Layout density | `pref:density` |
| Number precision | `pref:metricPrecision` |
| Date and number convention | `pref:locale` |
| Timeline colour encoding | `pref:chartColor` |
| Timeline ordering | `pref:chartSort` |
| Timeline row spacing | `pref:chartHeight` |
| Print orientation | `pref:reportOrientation` |

## Report options

| Capability | Identifier |
|---|---|
| Include private resident appendix | `pref:reportPeople` |
| Include evidence ledger | `pref:reportEvidence` |
| Include assumptions | `pref:reportAssumptions` |
| Include alternatives | `pref:reportAlternatives` |
| Include group comparisons | `pref:reportGroups` |
| Include headline measures | `pref:reportMetrics` |
| Include barrier summary | `pref:reportTimeline` |
| Include discussion notes | `pref:reportNotes` |
| Include room title and description | `pref:reportTitle` |
| Include report credits | `pref:reportFooter` |
| Include report date | `pref:reportDate` |
| Include current / proposed settings | `pref:reportBaseline` |
| Include limitations | `pref:reportLimitations` |
| Include method | `pref:reportMethods` |
| Start report sections on new pages | `pref:reportPageBreak` |
| Use colour in the report | `pref:reportAccent` |
| Include plain-language summary | `pref:reportSummary` |
