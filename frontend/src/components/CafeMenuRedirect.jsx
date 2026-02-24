import { Navigate, useParams } from "react-router-dom";

import { DEFAULT_CAFE_SLUG, isValidCafeSlug, normalizeCafeSlug } from "../constants/cafes";

export default function CafeMenuRedirect() {
  const { cafeSlug: rawCafeSlug } = useParams();
  const cafeSlug = normalizeCafeSlug(rawCafeSlug);
  const targetCafeSlug = isValidCafeSlug(cafeSlug) ? cafeSlug : DEFAULT_CAFE_SLUG;

  return <Navigate to={`/${targetCafeSlug}/menu`} replace />;
}

