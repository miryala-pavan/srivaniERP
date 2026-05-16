export declare enum CustomerType {
    REGULAR = "REGULAR",
    WALKIN = "WALKIN"
}
export declare class CreateCustomerDto {
    name: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
    customerType?: CustomerType;
}
