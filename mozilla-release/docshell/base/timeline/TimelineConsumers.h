/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_TimelineConsumers_h_
#define mozilla_TimelineConsumers_h_

#include "mozilla/UniquePtr.h"
#include "mozilla/LinkedList.h"
#include "mozilla/Vector.h"
#include "mozilla/TimeStamp.h"
#include "mozilla/Mutex.h"

#include "TimelineMarkerEnums.h"

class nsDocShell;
class nsIDocShell;

namespace mozilla {
class ObservedDocShell;
class AbstractTimelineMarker;

class TimelineConsumers
{
private:
  // Counter for how many timelines are currently interested in markers.
  static unsigned long sActiveConsumers;
  static LinkedList<ObservedDocShell>* sObservedDocShells;
  static LinkedList<ObservedDocShell>& GetOrCreateObservedDocShellsList();

  // Lock used when adding off-the-main-thread markers.
  static Mutex* sLock;

public:
  static Mutex& GetLock();

  static void AddConsumer(nsDocShell* aDocShell);
  static void RemoveConsumer(nsDocShell* aDocShell);
  static bool IsEmpty();
  static bool GetKnownDocShells(Vector<nsRefPtr<nsDocShell>>& aStore);

  // Methods for adding markers relevant for particular docshells, or generic
  // (meaning that they either can't be tied to a particular docshell, or one
  // wasn't accessible in the part of the codebase where they're instantiated).

  // These will only add markers if at least one docshell is currently being
  // observed by a timeline. Markers tied to a particular docshell won't be
  // created unless that docshell is specifically being currently observed.
  // See nsIDocShell::recordProfileTimelineMarkers

  // These methods create a custom marker from a name and some metadata,
  // relevant for a specific docshell.
  static void AddMarkerForDocShell(nsDocShell* aDocShell,
                                   const char* aName,
                                   MarkerTracingType aTracingType);
  static void AddMarkerForDocShell(nsIDocShell* aDocShell,
                                   const char* aName,
                                   MarkerTracingType aTracingType);

  static void AddMarkerForDocShell(nsDocShell* aDocShell,
                                   const char* aName,
                                   const TimeStamp& aTime,
                                   MarkerTracingType aTracingType);
  static void AddMarkerForDocShell(nsIDocShell* aDocShell,
                                   const char* aName,
                                   const TimeStamp& aTime,
                                   MarkerTracingType aTracingType);

  // These methods register and receive ownership of an already created marker,
  // relevant for a specific docshell.
  static void AddMarkerForDocShell(nsDocShell* aDocShell,
                                   UniquePtr<AbstractTimelineMarker>&& aMarker);
  static void AddMarkerForDocShell(nsIDocShell* aDocShell,
                                   UniquePtr<AbstractTimelineMarker>&& aMarker);

  // These methods create or clone markers relevant for a list of docshells.
  static void AddMarkerForDocShellsList(Vector<nsRefPtr<nsDocShell>>& aDocShells,
                                        const char* aName,
                                        MarkerTracingType aTracingType);
  static void AddMarkerForDocShellsList(Vector<nsRefPtr<nsDocShell>>& aDocShells,
                                        const char* aName,
                                        const TimeStamp& aTime,
                                        MarkerTracingType aTracingType);
  static void AddMarkerForDocShellsList(Vector<nsRefPtr<nsDocShell>>& aDocShells,
                                        UniquePtr<AbstractTimelineMarker>& aMarker);

  // These methods create or clone markers, none of which have to be tied to
  // a particular docshell.
  static void AddMarkerForAllObservedDocShells(const char* aName,
                                               MarkerTracingType aTracingType);
  static void AddMarkerForAllObservedDocShells(const char* aName,
                                               const TimeStamp& aTime,
                                               MarkerTracingType aTracingType);
  static void AddMarkerForAllObservedDocShells(UniquePtr<AbstractTimelineMarker>& aMarker);

  // Thread-safe versions of the above methods. Need to lock first using
  // the mutex returned by `TimelineConsumers::GetLock()`.
  static void AddOTMTMarkerForDocShell(nsDocShell* aDocShell,
                                       UniquePtr<AbstractTimelineMarker>& aMarker);
  static void AddOTMTMarkerForDocShell(nsIDocShell* aDocShell,
                                       UniquePtr<AbstractTimelineMarker>& aMarker);
  static void AddOTMTMarkerForDocShellsList(Vector<nsRefPtr<nsDocShell>>& aDocShells,
                                            UniquePtr<AbstractTimelineMarker>& aMarker);
  static void AddOTMTMarkerForAllObservedDocShells(UniquePtr<AbstractTimelineMarker>& aMarker);

};

} // namespace mozilla

#endif /* mozilla_TimelineConsumers_h_ */
