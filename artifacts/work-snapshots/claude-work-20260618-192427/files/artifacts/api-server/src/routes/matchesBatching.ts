type MatchParticipants = {
  userId1: string;
  userId2: string;
};

type ProfileWithBirthDate = {
  userId: string;
  birthDate?: string | null;
};

export function getOtherUserIdsForMatches(userId: string, matches: MatchParticipants[]) {
  const ids = matches.map((match) => (match.userId1 === userId ? match.userId2 : match.userId1));
  return [...new Set(ids)];
}

export function withProfileAge<TProfile extends ProfileWithBirthDate>(profile: TProfile) {
  return {
    ...profile,
    age: profile.birthDate
      ? Math.floor(
          (Date.now() - new Date(profile.birthDate).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : undefined,
  };
}

export function buildProfilesByUserId<TProfile extends { userId: string }>(profiles: TProfile[]) {
  return new Map(profiles.map((profile) => [profile.userId, profile] as const));
}
