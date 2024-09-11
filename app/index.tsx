import React, { useState, useEffect } from "react";
import {
	Image,
	Text,
	ScrollView,
	View,
	Button,
	TextInput,
	Modal,
	ActivityIndicator,
	Alert,
	FlatList,
	TouchableOpacity,
} from "react-native";
import axios from "axios";
import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";

interface ImageInterface {
	imageName: string;
	imageUrl: string;
	sha: string;
}
interface CategoryImage {
	categoryName: string;
	images: ImageInterface[];
}

export default function HomeScreen() {
	// Данные о категориях и фотографиях в них
	const [data, setData] = useState<CategoryImage[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [loading, setLoading] = useState(false);
	const [showSelectCategoryModal, setShowSelectCategoryModal] =
		useState(false);

	useEffect(() => {
		fetchCategories();
	}, []);

	// Запрос разрешения и выбор изображения
	const pickImageFromGallery = async (selectedCategory: string) => {
		const { status } =
			await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			alert("Необходимо разрешение на доступ к галерее!");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [4, 3],
			quality: 1,
		});

		if (!result.canceled) {
			handleUploadImage(result.assets[0].uri, selectedCategory);
		}
	};

	// Загрузка изображения
	const handleUploadImage = async (
		imageUri: string,
		selectedCategory: string
	) => {
		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${selectedCategory}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			const response = await fetch(imageUri);
			const blob = await response.blob();
			const reader = new FileReader();

			reader.onloadend = async () => {
				const base64data = reader.result?.toString().split(",")[1];
				const uploadResponse = await axios.put(
					`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/${Date.now()}.jpg`,
					{
						message: `Добавление нового изображения в категорию ${selectedCategory}`,
						content: base64data,
					},
					{
						headers: {
							Authorization: `token ${token}`,
						},
					}
				);

				if (uploadResponse.status === 201) {
					Alert.alert("Успех", "Изображение успешно загружено");
					fetchCategories(); // Обновляем список категорий
				} else {
					Alert.alert("Ошибка", "Не удалось загрузить изображение");
				}
			};

			reader.readAsDataURL(blob);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при добавлении изображения");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	// Получение категорий
	const fetchCategories = async () => {
		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = "public/category";
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			const categories = await Promise.all(
				response.data.map(async (item: any) => {
					const images = await fetchImages(item.name);
					return { categoryName: item.name, images };
				})
			);

			setData(categories);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при получении категорий");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	// Получение изображений в категории
	const fetchImages = async (
		categoryName: string
	): Promise<ImageInterface[]> => {
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${categoryName}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			return await Promise.all(
				response.data.map(async (image: any) => {
					const imageResponse = await axios.get(image.git_url, {
						headers: {
							Authorization: `token ${token}`,
							Accept: "application/vnd.github.VERSION.raw",
						},
						responseType: "arraybuffer",
					});

					const base64Image = Buffer.from(
						imageResponse.data,
						"binary"
					).toString("base64");
					return {
						imageName: image.name,
						imageUrl: `data:image/webp;base64,${base64Image}`,
						sha: image.sha,
					};
				})
			);
		} catch (error) {
			console.error(error);
			return [];
		}
	};

	// Добавление новой категории
	const addCategory = async () => {
		if (!newCategoryName) return;

		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${newCategoryName}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			await axios.put(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/.gitkeep`,
				{
					message: `Add new category ${newCategoryName}`,
					content: Buffer.from("").toString("base64"),
				},
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			Alert.alert("Успех", `Категория ${newCategoryName} добавлена`);
			setNewCategoryName("");
			fetchCategories(); // Обновляем список категорий
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при добавлении категории");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	// Удаление изображения
	const deleteImage = async (
		categoryName: string,
		imageName: string,
		sha: string
	) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить изображение ${imageName}?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						setLoading(true);
						const username = "IvanOrlovsky";
						const reponame = "forged-dragon";
						const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

						try {
							await axios.delete(
								`https://api.github.com/repos/${username}/${reponame}/contents/public/category/${categoryName}/${imageName}`,
								{
									data: {
										message: `Delete image ${imageName}`,
										sha,
									},
									headers: {
										Authorization: `token ${token}`,
									},
								}
							);
							Alert.alert(
								"Успех",
								`Изображение ${imageName} удалено`
							);
							fetchCategories(); // Обновляем список категорий
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении изображения"
							);
							console.error(error);
						} finally {
							setLoading(false);
						}
					},
				},
			]
		);
	};

	// Рендер изображений
	const renderCategoryImages = (category: CategoryImage) => {
		return (
			<View key={category.categoryName} style={{ marginBottom: 20 }}>
				<Text style={{ fontSize: 18, fontWeight: "bold" }}>
					{category.categoryName}
				</Text>
				<ScrollView horizontal>
					{category.images.map((image) => (
						<View key={image.imageName} style={{ marginRight: 10 }}>
							<Image
								source={{ uri: image.imageUrl }}
								style={{ width: 100, height: 100 }}
								resizeMode="cover"
							/>
							<Button
								title="Удалить"
								color="red"
								onPress={() =>
									deleteImage(
										category.categoryName,
										image.imageName,
										image.sha
									)
								}
							/>
						</View>
					))}
				</ScrollView>
			</View>
		);
	};

	return (
		<View style={{ padding: 20 }}>
			<Text
				style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}
			>
				Галерея категорий
			</Text>
			{loading ? (
				<ActivityIndicator size="large" color="#0000ff" />
			) : (
				<FlatList
					data={data}
					renderItem={({ item }) => renderCategoryImages(item)}
					keyExtractor={(item) => item.categoryName}
				/>
			)}

			<Button
				title="Добавить категорию"
				onPress={() => setShowSelectCategoryModal(true)}
			/>

			<Modal
				visible={showSelectCategoryModal}
				animationType="slide"
				onRequestClose={() => setShowSelectCategoryModal(false)}
			>
				<View style={{ padding: 20 }}>
					<Text style={{ fontSize: 18 }}>
						Введите название категории:
					</Text>
					<TextInput
						value={newCategoryName}
						onChangeText={setNewCategoryName}
						style={{
							borderWidth: 1,
							marginVertical: 10,
							padding: 5,
						}}
					/>
					<Button title="Создать" onPress={addCategory} />
					<Button
						title="Закрыть"
						onPress={() => setShowSelectCategoryModal(false)}
					/>
				</View>
			</Modal>
		</View>
	);
}
