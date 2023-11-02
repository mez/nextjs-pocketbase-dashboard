import { RecordListOptions } from 'pocketbase';

import {
  CustomerField,
  CustomersTable,
  FormattedCustomersTable,
  InvoiceForm,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

import { unstable_noStore as noStore } from 'next/cache';
import { initPocketbaseFromCookie } from './pb';

const ITEMS_PER_PAGE = 6;

export async function fetchRevenue() {
  noStore();
  // Add noStore() here prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).

  try {
    // Artificially delay a reponse for demo purposes.
    // Don't do this in real life :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));
    const pb = await initPocketbaseFromCookie();

    const data = await pb.collection('revenue').getFullList<Revenue>();

    // console.log('Data fetch complete after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    const data = await pb.collection('latestInvoices').getFullList()

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    // you could write custom view collection for the count, but I just use the totalItems property.
    const invoiceCountPromise = pb.collection('invoices').getList(1, 1)   // sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = pb.collection('customers').getList(1, 1) // sql`SELECT COUNT(*) FROM customers`;
    
    // here I create a custom view collection. makes my life easier. Just raw dog with sql!
    // https://pocketbase.io/docs/collections/#view-collection
    const invoiceStatusPromise = pb.collection('invoiceStatus').getList(1, 1);

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].totalItems ?? '0');
    const numberOfCustomers = Number(data[1].totalItems ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].items[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].items[0].pending ?? '0');


    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to card data.');
  }
}


export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    const queryOptions: RecordListOptions = {
      fields: 'id, amount, date, status, expand.customer.email, expand.customer.name, expand.customer.image_url',
      expand: 'customer',
      sort: '-date,-amount',
      filter: pb.filter("status ~ {:query} || customer.name ~ {:query} || customer.email ~ {:query}", { query })
    };

    const invoices = await pb.collection('invoices').getList(currentPage, ITEMS_PER_PAGE, queryOptions);

    const data = invoices.items.map((invoice) => ({
      ...invoice,
      ...invoice.expand?.customer,
    }));

    return data;


  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    const queryOptions: RecordListOptions = {
      fields: 'id',
      expand: 'customer',
      filter: pb.filter("status ~ {:query} || customer.name ~ {:query} || customer.email ~ {:query}", { query })
    };

    const invoices = await pb.collection('invoices').getList(1, ITEMS_PER_PAGE, queryOptions);


    return invoices.totalPages;

  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    const data = await pb.collection('invoices').getOne(id, {
      fields: 'id, customer, amount, status'
    })

    const invoice: InvoiceForm = {
      id: data.id,
      status: data.status,
      // Convert amount from cents to dollars
      customer_id: data.customer,
      amount: data.amount / 100,
    };

    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
  }
}

export async function fetchCustomers() {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    const customers = await pb.collection('customers').getFullList<CustomerField>({
      fields: 'id, name',
      sort: 'name'
    })



    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  noStore();

  try {
    const pb = await initPocketbaseFromCookie();

    // most of the query is done in the view collection! 
    const queryOptions: RecordListOptions = {
      filter: pb.filter("name ~ {:query} || email ~ {:query}", { query })
    };

    const data = await pb.collection('customersWithInvoicesInfo').getFullList<FormattedCustomersTable>(queryOptions)

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(Number(customer.total_pending)),
      total_paid: formatCurrency(Number(customer.total_paid)),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
  }
}

