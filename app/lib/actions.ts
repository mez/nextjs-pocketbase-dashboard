'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { initPocketbaseFromCookie } from './pb';


const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number().gt(0, {
    message: 'Please enter an amount greater than $0.'
  }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.'
  }),
  date: z.string()
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });
const UpdateInvoice = InvoiceSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  const pb = await initPocketbaseFromCookie();

  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await pb.collection('invoices').create({
      customer: customerId,
      status,
      amount: amountInCents,
      date
    })

  } catch (error) {
    return {
      message: 'Database error: Failed to create invoice.'
    }
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}


export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  const pb = await initPocketbaseFromCookie();

  const validatedFields = UpdateInvoice.safeParse(
    {
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status')
    }
  )

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;

  try {

    await pb.collection('invoices').update(id, {
      customer: customerId,
      status,
      amount: amountInCents
    })
  } catch (error) {
    return {
      message: 'Database error: Failed to update invoice.'
    }
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    const pb = await initPocketbaseFromCookie();

    await pb.collection('invoices').delete(id);
    revalidatePath('/dashboard/invoices');
    return {
      message: 'Deleted invoice.'
    }
  } catch (error) {
    return {
      message: 'Database error: Failed to delete invoice.'
    }
  }
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
  try {
    const pb = await initPocketbaseFromCookie();

    // I would create a zod schema here to validate the email and password. 
    // Too lazy for now.... look above for example of data validation. 
    const auth = await pb.collection('users').authWithPassword(formData.get('email') as string, formData.get('password') as string)

    if (pb.authStore.isValid) {
      cookies().set('pb_auth', pb.authStore.exportToCookie());
    }

    return 'ok';
  } catch (error) {
    console.log(error);

    return 'AuthError';
  }
}

export async function signout() {
  const pb = await initPocketbaseFromCookie();

  pb.authStore.clear();
  cookies().delete('pb_auth');

  redirect('/login');
}