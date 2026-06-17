'use client';

import AddToListButton from './AddToListButton';

interface Props {
  code: string;
  name: string;
  packLabel: string;
  sellingPrice: number;
  imageUrl?: string | null;
  inStock: boolean;
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
    />
  );
}
