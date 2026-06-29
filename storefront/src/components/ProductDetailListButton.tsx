'use client';

import AddToListButton from './AddToListButton';
import type { VolumeTier } from '@/context/CartContext';

interface Props {
  code: string;
  name: string;
  packLabel: string;
  sellingPrice: number;
  imageUrl?: string | null;
  inStock: boolean;
  volumeTiers?: VolumeTier[];
}

export default function ProductDetailListButton(props: Props) {
  return (
    <AddToListButton
      code={props.code}
      name={props.name}
      packLabel={props.packLabel}
      sellingPrice={props.sellingPrice}
      imageUrl={props.imageUrl}
      disabled={!props.inStock}
      volumeTiers={props.volumeTiers}
    />
  );
}
