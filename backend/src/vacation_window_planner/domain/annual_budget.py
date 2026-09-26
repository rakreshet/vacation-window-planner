from collections.abc import Callable
from time import monotonic
from typing import Literal

from pydantic import Field, StrictInt

from vacation_window_planner.domain.values import DomainValue

type LimitReason = Literal["candidate_limit", "state_limit", "transition_limit", "deadline"]


class AnnualPolicy(DomainValue):
    version: Literal["annual-v1"] = "annual-v1"
    candidate_limit: StrictInt = Field(default=12000, ge=1, le=12000)
    state_limit: StrictInt = Field(default=500000, ge=1, le=500000)
    transition_limit: StrictInt = Field(default=5000000, ge=1, le=5000000)
    time_limit_seconds: StrictInt = Field(default=5, ge=1, le=5)


DEFAULT_ANNUAL_POLICY = AnnualPolicy()


class WorkCounters(DomainValue):
    candidates: int = 0
    states: int = 0
    transitions: int = 0


class WorkLimitExceeded(Exception):
    def __init__(self, reason: LimitReason) -> None:
        self.reason = reason
        super().__init__(reason)


class WorkBudget:
    def __init__(
        self,
        policy: AnnualPolicy = DEFAULT_ANNUAL_POLICY,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self.policy = policy
        self._clock = clock
        self._deadline = clock() + policy.time_limit_seconds
        self._candidates = 0
        self._states = 0
        self._transitions = 0

    @property
    def counters(self) -> WorkCounters:
        return WorkCounters(
            candidates=self._candidates, states=self._states, transitions=self._transitions
        )

    def checkpoint(self) -> None:
        if self._clock() >= self._deadline:
            raise WorkLimitExceeded("deadline")

    def candidate(self) -> None:
        self._candidates += 1
        self._check("candidate_limit", self._candidates, self.policy.candidate_limit)

    def state(self) -> None:
        self._states += 1
        self._check("state_limit", self._states, self.policy.state_limit)

    def transition(self) -> None:
        self._transitions += 1
        self._check("transition_limit", self._transitions, self.policy.transition_limit)

    def _check(self, reason: LimitReason, count: int, limit: int) -> None:
        if count > limit:
            raise WorkLimitExceeded(reason)
        self.checkpoint()
